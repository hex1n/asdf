**问题**: 调研社区如何处理本地已安装插件/包/配置从远程同步更新，并推导 asdf-skills 的 skill 分发方案。
**深度**: Standard
**核心结论**: 社区最佳可借鉴模式不是直接覆盖本地 skill，也不是把每个 installed skill 变成可编辑 git clone，而是维护独立 source/control state，再把只读运行时目录物化出来。
**产物类型**: supporting
**验证状态**: official docs and local installer code read in this session; no prototype implemented.
**开放问题**: 2 - see end.

## TL;DR

影响: asdf-skills 应把 Codex 和 Claude Code 共同可见的 `~/.agents/skills/<name>` 视为 materialized cache，而不是 source repo。  
风险: 如果只做 rsync 覆盖，会丢本地 drift；如果 per-skill git clone，会污染运行时目录并鼓励直接编辑。  
下一步: 设计 `.managed/` control directory，包含 source mirror、per-skill provenance、lock/index、backup 和 drift gate。

## 社区模式

| 生态 | 实现模式 | 可借鉴点 | 不适合点 |
|---|---|---|---|
| asdf plugins | plugin 由 Git URL 添加，支持 `plugin update --all` 和单插件更新 | per-plugin provenance 和 update 粒度清楚 | plugin 目录本身就是 git repo，和“installed cache 只读物化结果”不完全一致 |
| Homebrew taps | tap 是 Git repository，`brew update` 自动更新 taps | source repositories 和 update-all 语义成熟 | tap 是 formula source，不是运行时物化目录 |
| lazy.nvim | 更新后写 `lazy-lock.json`，可 restore 到 lockfile revision | lockfile 记录已安装 revision，利于多机复现 | runtime plugin 目录仍通常是 git clone |
| npm | `node_modules/.package-lock.json` 是 hidden lockfile；如果其他 CLI 改动 tree，会被检测并忽略 | installed tree 可以有 machine state，用于判断是否仍可信 | hidden lockfile 不一定能检测所有手工文件编辑 |
| pnpm | content-addressable store + project `node_modules/.pnpm` + symlinks/hardlinks | store 和 materialized runtime tree 分离 | skill 不一定适合硬链接/symlink，需验证 loader 行为 |
| chezmoi | source state 在 `~/.local/share/chezmoi`，apply 到目标；目标被外部改动后会提示 | 最接近本项目: source state 与 target cache 分离，并有 dry-run/overwrite gate | 面向 dotfiles，粒度比 skill directory 更细 |
| GNU Stow | package 私有树通过 symlinks 显示到 target tree；冲突时不盲目覆盖 | package/private tree 与 target tree 分离，冲突保守 | 不提供远程更新和 provenance，本身不是 updater |
| VS Code extensions | 默认自动更新 extensions，可关闭；产品本体被 patch 会标记 unsupported | 自动更新和 opt-out 语义清楚；patching installed artifacts 被视为 unsupported | extension 是 marketplace package，不是 repo subtree sync |
| Ansible Galaxy | 安装/升级 roles/collections，`--force` 才覆盖已有内容 | 覆盖是显式危险操作 | force overwrite 语义太粗，缺少细粒度 drift gate |

## 推导

当前系统级 `skill-installer` 的 `install-skill-from-github.py` 在目标目录已存在时 abort；它解决 install，不解决 update/sync。这个行为与 Ansible Galaxy 的非 force 默认类似，但缺少 upgrade path。

对 asdf-skills，更好的架构应结合三类社区经验：

1. **Git source provenance** from asdf/Homebrew/lazy.nvim.
2. **Source state vs target cache separation** from chezmoi, pnpm, and Stow.
3. **Explicit force/unsupported patch semantics** from Ansible Galaxy and VS Code.

## 推荐模型

```text
~/.agents/skills/                # shared installed skill cache for Codex and Claude Code
  deep-research/                 # runtime-visible materialized skill
  java-stack-craft/
  .managed/
    registry.json                # managed skill index
    locks/
      deep-research.json         # per-skill provenance and content hash
      java-stack-craft.json
    sources/
      github.com/hex1n/asdf.git/ # source mirror or checkout cache
    backups/
      deep-research/2026-06-05T230000/
```

Recommended update flow:

1. Resolve source repo/ref/path from the per-skill lock.
2. Fetch/update the source mirror.
3. Compute desired source tree hash for `skills/<name>`.
4. Compute current installed cache hash, excluding `.managed`.
5. If current hash differs from lock hash, report **Cache Drift** and stop unless `--force`.
6. If clean, backup current cache, atomically replace it with the desired tree, then update the lock.

This is stronger than a single `.managed-skills.json` because each skill has an isolated lock and backup path. It is stronger than per-skill git clones because runtime-visible directories stay clean and do not invite local edits. The model is runtime-neutral: Codex and Claude Code consume the same materialized cache, while sync metadata stays outside the skill directories.

## Open Questions

1. Should materialization be copy-based or symlink-based? Copy is safer without verifying Codex/Claude skill loader symlink behavior.
2. Should source mirrors be bare Git repos, sparse checkouts, or downloaded archives? Git mirrors preserve provenance best; archives are simpler for public GitHub but weaker for private repos and exact history.

## Source Audit

| Claim | Source | Access |
|---|---|---|
| asdf plugins are added by Git URL, support `plugin update --all` and single-plugin update | https://asdf-vm.com/manage/plugins.html | fetched in this session |
| Homebrew taps are Git repositories cloned under `Library/Taps` and updated by `brew update` | https://docs.brew.sh/Taps | fetched in this session |
| lazy.nvim records installed revisions in `lazy-lock.json` and can restore plugins from the lockfile | https://lazy.folke.io/usage/lockfile | fetched in this session |
| npm uses hidden `node_modules/.package-lock.json` only when the tree still matches expected conditions, and detects other CLI mutations | https://docs.npmjs.com/cli/v8/configuring-npm/package-lock-json/ | fetched in this session |
| pnpm separates a content-addressable store from `node_modules` materialization via hard links and symlinks | https://pnpm.io/symlinked-node-modules-structure | fetched in this session |
| chezmoi stores desired source state separately and prompts if a target changed since it last wrote it | https://www.chezmoi.io/quick-start/ and https://www.chezmoi.io/reference/commands/apply/ | fetched in this session |
| GNU Stow keeps package trees separate and makes them appear in a target tree via symlinks; it was designed to administer independent packages safely | https://www.gnu.org/software/stow/manual/stow.html | fetched in this session |
| VS Code auto-updates extensions by default and marks patched product installs unsupported | https://code.visualstudio.com/docs/supporting/faq | fetched in this session |
| Ansible Galaxy exposes `--upgrade` and `--force`/force overwrite semantics | https://docs.ansible.com/projects/ansible/latest/cli/ansible-galaxy.html | fetched in this session |
| Current Codex system skill installer aborts when destination exists | `/Users/hex1n/.agents/skills/.system/skill-installer/scripts/install-skill-from-github.py` | read in this session |
| Claude Code uses the same installed skills on this machine | `/Users/hex1n/.claude/skills -> ../.agents/skills` | checked with `readlink` in this session |
