import json
import os
import re
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import psycopg
from supabase import create_client

HERE = Path(__file__).parent
for line in (HERE.parent / ".env").read_text().splitlines():
    if "=" in line and not line.startswith("#"):
        key, value = line.split("=", 1)
        os.environ[key.strip()] = value.strip()

from Preprocessing.chunk_and_embed import Document_processing  # noqa: E402

DOCS_DIR = HERE / "documents"  # the original papers, which are kept
DOWNLOADS = HERE / "downloads" / "pdf"  # each new paper is deleted once stored
MANIFEST = HERE / "downloads" / "manifest.jsonl"
FAILED = HERE / "downloads" / "failed_papers.jsonl"
WORKERS = 8
SIZE_LIMIT_MB = 420  # the free plan's database limit is 500 MB
ARXIV_DELAY = 3.2  # arXiv allows one request every 3 seconds

arxiv_lock = threading.Lock()
failed_lock = threading.Lock()
thread_state = threading.local()
out_of_budget = threading.Event()


def get_processor():
    """One Supabase connection per worker: sharing one across threads drops connections."""
    if not hasattr(thread_state, "processor"):
        client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
        thread_state.processor = Document_processing([], client)
    return thread_state.processor


def fetch(url, path):
    """curl, because Python's downloader kept getting cut off on PDFs over about 4 MB."""
    subprocess.run(
        ["curl", "-fsSL", "--retry", "3", "--max-time", "180", "-A", "RAG-QA-ingest/1.0", "-o", str(path), url],
        check=True, capture_output=True,
    )


def download(paper):
    """arXiv's public mirror first; papers too new for it come from arXiv at its allowed rate."""
    name = paper["arxiv_id"] + paper["version"]
    month = paper["arxiv_id"].split(".")[0]
    path = DOWNLOADS / f"{name}.pdf"
    try:
        fetch(f"https://storage.googleapis.com/arxiv-dataset/arxiv/arxiv/pdf/{month}/{name}.pdf", path)
    except subprocess.CalledProcessError:
        with arxiv_lock:
            fetch(f"https://export.arxiv.org/pdf/{name}", path)
            time.sleep(ARXIV_DELAY)
    return path


def process_paper(paper):
    """One failed paper is recorded and skipped, so the run moves on to the next."""
    path = None
    try:
        path = paper.get("path") or download(paper)
        get_processor().process_and_store_doc(str(path), paper.get("title"), paper.get("abstract"))
        return True
    except Exception as error:
        if re.search(r"no credits|insufficient_quota|spend_limit", repr(error)):
            out_of_budget.set()
        with failed_lock, FAILED.open("a") as out:
            out.write(json.dumps({"paper": paper.get("arxiv_id", str(path)), "error": repr(error)[:300]}) + "\n")
        return False
    finally:
        if path and "path" not in paper:
            Path(path).unlink(missing_ok=True)


def main(limit=None):
    DOWNLOADS.mkdir(parents=True, exist_ok=True)

    with psycopg.connect(os.environ["SUPABASE_DB_URL"], autocommit=True) as connection:
        def size_mb():  # a fresh connection, because this one can go idle during long batches
            with psycopg.connect(os.environ["SUPABASE_DB_URL"], autocommit=True) as check:
                return check.execute("select pg_database_size(current_database()) / 1048576.0").fetchone()[0]

        # Stored means it has chunks and its search text already starts with its title
        done = {row[0] for row in connection.execute(
            "select d.doc_id from documents d where left(d.document_summary, length(d.title)) = d.title "
            "and length(d.title) > 0 and exists (select 1 from chunks c where c.doc_id = d.doc_id)"
        )}

        manifest = [json.loads(line) for line in MANIFEST.open()]
        by_id = {paper["arxiv_id"]: paper for paper in manifest}
        papers = []
        for path in sorted(DOCS_DIR.glob("*.pdf")):  # the original papers, using arXiv's metadata if listed
            if path.stem not in done:
                known = by_id.get(path.stem.split("v")[0], {})
                papers.append({"path": path, "title": known.get("title"), "abstract": known.get("abstract")})
        for paper in manifest:
            name = paper["arxiv_id"] + paper["version"]
            if name not in done and not (DOCS_DIR / f"{name}.pdf").exists():
                papers.append(paper)
        papers = papers[:limit]
        start_mb = size_mb()
        print(f"{len(done)} stored, {len(papers)} to process, database {start_mb:.0f} MB", flush=True)

        with ThreadPoolExecutor(WORKERS) as pool:
            for start in range(0, len(papers), WORKERS * 2):
                if size_mb() >= SIZE_LIMIT_MB:
                    print(f"stopping at the {SIZE_LIMIT_MB} MB limit", flush=True)
                    break
                list(pool.map(process_paper, papers[start:start + WORKERS * 2]))
                if out_of_budget.is_set():
                    print("stopping: OpenAI credits or spend limit reached", flush=True)
                    break
                print(f"{start + WORKERS * 2} of {len(papers)} attempted, database {size_mb():.0f} MB", flush=True)


if __name__ == "__main__":
    import argparse

    cli = argparse.ArgumentParser()
    cli.add_argument("--limit", type=int)
    main(cli.parse_args().limit)
