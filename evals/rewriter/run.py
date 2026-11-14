"""Run the query rewriter's prompt on the test conversations in cases.json.

Usage (from the repo root, with OPENAI_API_KEY in .env):
    .venv/bin/python evals/rewriter/run.py                      # the prompt in the working copy
    .venv/bin/python evals/rewriter/run.py --ref HEAD           # the prompt in a git commit, e.g. the deployed one

It reads the prompt straight from supabase/functions/Query_rewriter/index.ts and builds the
message the same way the function does, so it tests exactly what would be deployed.
"""

import argparse
import json
import re
import subprocess
from pathlib import Path

from openai import OpenAI

ROOT = Path(__file__).resolve().parents[2]
FUNCTION = "supabase/functions/Query_rewriter/index.ts"
MAX_ANSWER_LENGTH = 1000  # same as the function


def load_prompt(ref: str | None) -> str:
    source = (
        subprocess.run(["git", "show", f"{ref}:{FUNCTION}"], cwd=ROOT, capture_output=True, text=True, check=True).stdout
        if ref
        else (ROOT / FUNCTION).read_text()
    )
    return source.split("const INSTRUCTIONS = `", 1)[1].split("`;", 1)[0]


def user_message(message: str, history: list[dict], with_original: bool = False) -> str:
    """Mirrors userMessage() in the function. with_original also sends the user's own words (an experiment, not deployed)."""
    if not history:
        return message
    turns = "\n\n".join(
        f"Earlier question {i}: {t['question']}\nSearched as: {t['query']}\nAnswer {i}: {t['answer'][:MAX_ANSWER_LENGTH]}"
        if with_original
        else f"Earlier question {i}: {t['query']}\nAnswer {i}: {t['answer'][:MAX_ANSWER_LENGTH]}"
        for i, t in enumerate(history, 1)
    )
    return f"Conversation so far (oldest first):\n{turns}\n\nNew message: {message}"


def check(case: dict, result: dict) -> list[str]:
    """Returns what went wrong; empty means the case passed."""
    problems = []
    if result.get("on_topic", True) is not case["on_topic"]:
        problems.append(f"on_topic should be {case['on_topic']}")
    query = result.get("query", "")
    for pattern in case.get("must", []):
        if not re.search(pattern, query, re.I):
            problems.append(f"missing /{pattern}/")
    for pattern in case.get("must_not", []):
        if re.search(pattern, query, re.I):
            problems.append(f"should not contain /{pattern}/")
    return problems


def load_key() -> str:
    for line in (ROOT / ".env").read_text().splitlines():
        if line.startswith("OPENAI_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("OPENAI_API_KEY not found in .env")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ref", help="git commit to read the prompt from (default: working copy)")
    parser.add_argument("--runs", type=int, default=3, help="runs per case, to catch unstable answers")
    parser.add_argument("--with-original", action="store_true", help="also send the user's own words in the history (not what the function does)")
    parser.add_argument("--model", default="gpt-4.1-mini", help="the function uses gpt-4.1-mini")
    args = parser.parse_args()

    client = OpenAI(api_key=load_key())
    prompt = load_prompt(args.ref)
    cases = json.loads((Path(__file__).parent / "cases.json").read_text())
    passed = 0

    for case in cases:
        outcomes = []
        for _ in range(args.runs):
            completion = client.chat.completions.create(
                model=args.model,
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": user_message(case["message"], case["history"], args.with_original)},
                ],
                temperature=0,
                max_tokens=150,
                response_format={"type": "json_object"},
            )
            result = json.loads(completion.choices[0].message.content or "{}")
            outcomes.append((result, check(case, result)))
        ok = all(not problems for _, problems in outcomes)
        passed += ok
        print(f"{'PASS' if ok else 'FAIL'}  {case['name']}\n      \"{case['message']}\"")
        for result, problems in {json.dumps(r, sort_keys=True): (r, p) for r, p in outcomes}.values():
            print(f"      -> {result.get('on_topic')} | {result.get('query')}" + (f"   [{'; '.join(problems)}]" if problems else ""))
    print(f"\n{passed}/{len(cases)} cases passed every run ({args.runs} runs each), prompt: {args.ref or 'working copy'}, model: {args.model}")


if __name__ == "__main__":
    main()
