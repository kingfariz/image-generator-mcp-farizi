## Why this MCP limits file operations

For safety, this MCP intentionally avoids giving AI agents too much freedom over file operations.

Long-context AI agents can hallucinate, especially when working with very large context windows. In the worst case, an agent can misunderstand the project structure and accidentally modify or delete files it shouldn't touch.

This isn't necessarily a problem with the underlying model. Even frontier models can make these mistakes when they're given too much context and too much authority over the filesystem.

That's why this MCP takes a more controlled approach:

- MCP-generated outputs are written under `public/`.
- The AI can then **copy the output where it needs to go using normal command-line operations**.
- The MCP itself does not provide an unrestricted workflow for the AI to freely manipulate your project files.

The goal is simple: **limit the blast radius when an AI inevitably gets something wrong.**

More autonomy isn't always safer. Sometimes giving an AI fewer ways to break your project is the better engineering decision.
