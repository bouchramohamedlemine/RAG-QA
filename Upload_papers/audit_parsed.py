"""Checks the parsed papers against arXiv's own abstracts, and writes a sample to read by hand.

An abstract comes from arXiv's metadata, separately from the PDF, so finding its text in
what was extracted from the PDF is independent evidence that the paper was read correctly.
"""
import glob
import gzip
import json
import random
import re
import statistics as st
from pathlib import Path

DATA = Path(__file__).parent / "downloads"
WINDOW = 5  # consecutive words that must match


def words(text):
    # Line-break hyphens differ between a PDF and the metadata, so join them first.
    return re.findall(r"[a-z0-9]+", text.replace("-\n", "").replace("- ", "").lower())


def abstract_found(abstract, text):
    """Share of the abstract's 5-word runs that appear in the extracted text."""
    tokens = words(abstract)
    runs = {" ".join(tokens[i:i + WINDOW]) for i in range(len(tokens) - WINDOW + 1)}
    if not runs:
        return None
    haystack = " ".join(words(text))
    return sum(run in haystack for run in runs) / len(runs)


papers = []
for path in glob.glob(str(DATA / "parsed" / "*.json.gz")):
    with gzip.open(path, "rt") as file:
        papers.append(json.load(file))

scores = {}
for paper in papers:
    score = abstract_found(paper["abstract"], " ".join(c["content"] for c in paper["chunks"]))
    if score is not None:
        scores[paper["arxiv_id"]] = score

values = list(scores.values())
chunks = [len(p["chunks"]) for p in papers]
print(f"papers parsed: {len(papers)}")
print(f"chunks per paper: median {st.median(chunks):.0f}, min {min(chunks)}, max {max(chunks)}")
print(f"abstract found in extracted text: median {st.median(values):.0%}")
print(f"  at least 80% found: {sum(v >= 0.8 for v in values)} papers")
print(f"  50-80% found:       {sum(0.5 <= v < 0.8 for v in values)} papers")
print(f"  under 50% found:    {sum(v < 0.5 for v in values)} papers")
failed = DATA / "failed.jsonl"
print(f"failed to parse: {sum(1 for _ in failed.open()) if failed.exists() else 0}")

random.seed(7)
sample = random.sample(papers, 15)
lowest = sorted(papers, key=lambda p: scores.get(p["arxiv_id"], 1))[:5]
with (DATA / "audit.md").open("w") as out:
    out.write("# Parsed papers to compare against arXiv\n\n")
    for heading, group in (("Random sample", sample), ("Lowest abstract match", lowest)):
        out.write(f"## {heading}\n\n")
        for p in group:
            chunk = p["chunks"][len(p["chunks"]) // 2]
            out.write(f"### {p['title']}\n\nhttps://arxiv.org/abs/{p['arxiv_id']}\n\n")
            out.write(f"{len(p['chunks'])} chunks, {len(p['sections'])} sections, "
                      f"abstract match {scores.get(p['arxiv_id'], 0):.0%}\n\n")
            out.write(f"Section: {chunk['section']} / {chunk['subsection']}\n\n> {chunk['content'][:600]}\n\n")
print(f"sample written to {DATA / 'audit.md'}")
