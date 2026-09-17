# 代码实现理由记录

记录某段代码为什么必须这样实现，帮助后续修改者判断哪些写法可以调整，哪些会改变行为。

## 用途

这些记录是个人维护的代码索引，放在 Git 忽略的 `docs/rationale/` 下。
每条记录对应当前仍成立的实现理由；项目需求、决策历史和验证结果分别保存在各自的文档中。
本目录提供使用标准库的 Node.js 命令行工具，用于查找记录、校验格式和定位代码片段。

```text
docs/rationale/
├── identity/
│   ├── 01-canonical-keys.md
│   └── 02-normalization.md
└── scheduling/
    └── 01-retry-boundary.md
```

只有在看似自然的改写可能破坏行为时才创建记录。文件按稳定的业务领域或代码职责组织，
规模增大时再拆分；文件名的两位数字前缀表示阅读顺序。每个文件以主题和一行 `TL;DR` 开头。

## 记录格式

```markdown
# 身份标识 · 稳定键
> TL;DR：记录哪些身份标识需要跨持久化边界保持稳定。

## W-001 · 一句话点明改成自然写法后哪个行为会变错

- **文件路径** `relative/path/File.ext`
- **代码片段** `在该文件中唯一、承载实际行为的代码片段`
- **实现理由** 先说明这段代码做什么，再沿数据或控制流解释为什么这样写，以及简化后会改变什么
```

三个字段依次回答：**在哪里、哪段代码、为什么这样写**。文件路径相对于仓库根目录；
一个理由涉及多处代码时，可以重复“文件路径／代码片段”对。字段下方缩进两格的行属于该字段；
顺序、精度或两条并行路径，用缩进的 ```text 块画出来比散文好校对。

记录是一次**中断**，不是描述。读者是因为碰到了被锚住的那段代码才看到它的——适不适用已经由锚点
回答了，所以标题应该回答"我为什么得停下来"：写清**改成那个更自然的写法后，哪个行为会变错**。
机制由 ID（锚住什么）和 `实现理由`（为什么）各自承担，标题再复述一遍机制等于把同一件事说三次。

W-ID 是名字不是位置：它按记录锚住的东西命名（`W-调用顺序`），在仓库内唯一，
与前后记录的编号没有关系，数值大也不代表更新。标题陈述这次的判断，随理解变化可以改写，
ID 不动。文件内的记录按代码的流程排，不按 ID 排。
需要说明复杂顺序时，可在实现理由下补一小段缩进流程或伪代码。

三个字段名是记录正文里仅有的字段，其他写法一律拒绝。
完整格式与内容要求见 [REFERENCE.md](REFERENCE.md#active-entry-schema)。

## 查找与校验

```bash
node "$HOME/.agents/skills/rationale-records/scripts/rationale.mjs" check --full
node "$HOME/.agents/skills/rationale-records/scripts/rationale.mjs" check --incremental
node "$HOME/.agents/skills/rationale-records/scripts/rationale.mjs" find W-001
node "$HOME/.agents/skills/rationale-records/scripts/rationale.mjs" find TypeName#member
node "$HOME/.agents/skills/rationale-records/scripts/rationale.mjs" find path/to/File.ext:120 --full
```

匹配代码片段时忽略空白、缩进和换行，保留字符串、注释和 token 边界。
校验器检查记录格式、W-ID 唯一性、文件存在性和片段唯一性；解释是否仍符合调用方、
生产方和配置的当前语义，需要按 [SKILL.md](SKILL.md) 核对。

全量和增量校验返回 PASS、FAIL 或明确的 SKIP。增量状态存放在用户目录的
`~/.agents/state/rationale-records` 下，通过原子替换更新；状态无效时重建全量索引。

## 工作树交接

关联工作树跳过正式校验，通过 `handoff-create` 封存交接说明或 `none` 结果。
任务合入主检出后，先整合仍有效的实现理由，再运行 `handoff-consume` 和 `worktree-finish`。
具体命令、回执要求及失败处理见 [REFERENCE.md](REFERENCE.md#worktree-handoff)。
