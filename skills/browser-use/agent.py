#!/usr/bin/env python3
"""
Reusable browser-use agent runner.
Uses your Pi auth.json credentials automatically.

Usage:
  uv run agent.py "Find the top post on Hacker News"
  uv run agent.py --model zai "Search for..."
  uv run agent.py --model google "Go to..."
  uv run agent.py --max-steps 20 "Do something complex"
  uv run agent.py --headless false "Show the browser"
"""

import argparse
import asyncio
import json
import os
import sys

from dotenv import load_dotenv

load_dotenv()

# Resolve ZAI key from Pi's auth.json
def _get_zai_key():
	auth_path = os.path.expanduser("~/.pi/agent/auth.json")
	try:
		with open(auth_path) as f:
			auth = json.load(f)
		return auth.get("zai", {}).get("key")
	except Exception:
		return os.environ.get("ZAI_API_KEY")


def get_llm(model: str):
	"""Create LLM instance based on model name."""
	if model == "zai":
		from browser_use import ChatOpenAI

		api_key = _get_zai_key()
		if not api_key:
			raise ValueError("No ZAI key found in ~/.pi/agent/auth.json or ZAI_API_KEY env var")
		return ChatOpenAI(
			model="glm-5",
			base_url="https://api.z.ai/api/coding/paas/v4",
			api_key=api_key,
		)
	elif model == "google":
		from browser_use import ChatGoogle

		return ChatGoogle(model="gemini-2.0-flash")
	elif model == "openai":
		from browser_use import ChatOpenAI

		return ChatOpenAI(model="gpt-4.1-mini")
	elif model == "anthropic":
		from browser_use import ChatAnthropic

		return ChatAnthropic(model="claude-sonnet-4-20250514", temperature=0.0)
	elif model == "browser-use":
		from browser_use import ChatBrowserUse

		return ChatBrowserUse()
	elif model == "ollama":
		from browser_use import ChatOllama

		return ChatOllama(model="llama3.2")
	else:
		raise ValueError(
			f"Unknown model: {model}. Choose: zai, google, openai, anthropic, browser-use, ollama"
		)


async def run_agent(task: str, model: str, headless: bool, vision: bool, max_steps: int):
	from browser_use import Agent, Browser

	browser = Browser(headless=headless)
	llm = get_llm(model)

	agent = Agent(
		task=task,
		llm=llm,
		browser=browser,
	)

	result = await agent.run(max_steps=max_steps)

	# Extract final result
	final = result.final_result()
	if final:
		print("\n✅ RESULT:")
		print(final)
	else:
		print("\n✅ Agent completed. Check output above for details.")

	await browser.stop()
	return result


def main():
	parser = argparse.ArgumentParser(description="Run a browser-use agent task")
	parser.add_argument("task", help="Task description for the agent")
	parser.add_argument(
		"--model",
		default="zai",
		choices=["zai", "google", "openai", "anthropic", "browser-use", "ollama"],
		help="LLM to use (default: zai — uses your Pi subscription)",
	)
	parser.add_argument(
		"--headless",
		default="true",
		choices=["true", "false"],
		help="Run browser headless (default: true)",
	)
	parser.add_argument(
		"--vision",
		default="true",
		choices=["true", "false"],
		help="Enable vision (default: true)",
	)
	parser.add_argument(
		"--max-steps",
		type=int,
		default=30,
		help="Maximum number of agent steps (default: 30)",
	)

	args = parser.parse_args()

	headless = args.headless == "true"
	use_vision = args.vision == "true"

	asyncio.run(
		run_agent(
			task=args.task,
			model=args.model,
			headless=headless,
			vision=use_vision,
			max_steps=args.max_steps,
		)
	)


if __name__ == "__main__":
	main()
