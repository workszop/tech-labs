# Tech Labs

Interactive labs that show how AI systems work, step by step, in the browser.

| Lab | What it is | Live |
|-----|------------|------|
| [RAG Lab](rag-lab/README.md) | Build a small Retrieval-Augmented Generation system from a fictional company's documents and watch every step: chunking, vectors, cosine search, the prompt and the answer. Polish by default, English available. | https://tech-labs.warsztaty-ai.com/rag-lab/ |
| [Service Agent Lab](agent-lab/README.md) | Watch an AI agent handle customer-service requests for a fictional appliance company: which simulated company systems it queries, which tools it calls, what comes back, and when it asks a human for approval. Polish by default, English available. | https://tech-labs.warsztaty-ai.com/agent-lab/ |

Each lab lives in its own folder with its own README and is published under the same folder name. One GitHub Actions workflow, [`.github/workflows/pages.yml`](.github/workflows/pages.yml), checks and builds every lab and publishes the whole site. The site root, https://tech-labs.warsztaty-ai.com/, is the labs index ([index.html](index.html)): add a card there for every new lab.
