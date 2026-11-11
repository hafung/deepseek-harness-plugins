# DeepSeek Harness 插件开发笔记

本项目基于 Windows 桌面版 `0.2.0-rc.2` 开发。查接口时先在 **应用 → 关于 DeepSeek Harness** 确认版本，然后打开对应标签下的源码。版本号相同也可能有多个桌面构建，实际验收以目标桌面端为准。 [本项目对照的版本](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.0-rc.2)

## 新增一个侧栏页面

1. 在 `plugins/` 下建立独立目录，给 npm 包、补丁行和面板各自选定唯一 ID。复制待办插件的四个安装文件作为起点，并换掉原有标识与业务逻辑。
2. 在 `package.json` 声明 `dsh.bundle.patch`、`dsh.client.platform: "web"` 和 `exports["./client"]`。补丁行的 `name`、清单的包名、`window.__ModuleLoader__.load()` 的 ID 使用同一个包名。纯页面插件的 Host 入口可以是空的 `apply()`。
3. 在浏览器入口通过 `ctx.slots.inject()` 等待槽位声明，再用 `ctx.slots.register()` 注册。侧栏 `sidebar.panellist` 的 `id` 与主区域 `main` 的 `key` 取同一个面板 ID。前者负责菜单文字、图标和顺序，后者负责页面。
4. 从 Harness 模块加载器取 React，用 `dsh.client.inject` 声明浏览器插件依赖，用导出的 `inject` 声明组件需要的上下文服务。优先通过槽位和服务复用 Harness 的生命周期与布局。 [官方 UI 插件模板](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.0-rc.2/packages/preset/agent-preset/skills/cordis-plugin-development/templates/decoration) · [侧栏槽位](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/client/ui-sidebar/README.zh.md#全局面板入口)

## 后台派发给主 Agent

- 调用 `workspaces.initializeDefault()` 获取 Harness 记录的默认工作区。已初始化时可拿到已有工作区，包含已改过显示名称的情况。返回空值时，提示用户当前配置缺少可用的默认工作区。 [默认工作区的实现](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/workspace/workspace/src/index.ts)
- 用 `sessions.create({ workspaceId, sessionId })` 创建并挂到默认工作区。用 `sessions.using()` 持有会话引用，在回调内执行 `reference.binding.session.prompt(content, 'queue', undefined, requestId)`。这条链路保持当前页面，`uiWorkspace.openSession()` 留给明确的界面导航。 [会话服务接口](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/api/session-controller/src/client/contract/sessions.ts) · [消息提交接口](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/api/session-controller/src/client/contract/session.ts)
- 用待办 ID 派生稳定的会话 ID，并用稳定的请求 ID 提交消息。超时后沿用同一组 ID 和首次提交的内容。Host 在已接受的请求上返回既有结果。页面以回执为准显示「已发送」，清单完成状态由用户单独勾选。 [Host 会话创建与消息入队](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/api/session-controller/src/commands.ts)

## 把提示词载入会话输入框

专家的「应用」不经过 Host 发送，而是直接写当前会话的草稿。可用的扩展点在 `conversation.input.left`：它的标准 props 包含 `inputActions`、`useInput` 和 `sessionId`。

- 注册一个不渲染内容的桥接组件，把最新的 `inputActions`、`sessionId`、`draft`、`phase` 和 `occurrences` 存到模块级对象。切换主面板时组件会卸载，但输入框实例属于会话作用域，桥接保存的 `inputActions` 仍然有效，所以回来点击「应用」时还能写入。
- 空草稿用 `setDraft(text)`。已有草稿时，用 `captureInsertion()` 拿到 `draftRev`，再用 `insertText('\n\n' + text, span)` 追加；`span` 以草稿末尾为插入点。带引用 chip 的草稿改用捕获的光标位置，避免坐标错位。`insertText` 返回 `false` 表示版本已变化，退回 `setDraft`。
- 写入前确认当前主会话一致：`ctx.uiSession.current.getSnapshot().key` 给出主会话 ID，取不到时用 `ctx.sessions.list` 中 `retainedBy.mainView > 0` 的行兜底。不一致或没有会话时不要猜测目标：没有会话才用 `uiWorkspace.startSession(undefined, { prompt, whenDraftExists: 'append' })` 新建并预填。
- 写入后用 `ctx.layout.selectPanel('conversation')` 回到对话，再在下一帧聚焦可见的 `[contenteditable="true"]`。焦点只是增强，失败不影响载入。
- 顶部提示放在 `shell.overlay`，撤销闭包要捕获写入时的 `inputActions`，不要在点击时重新读取桥接对象。

## 改品牌、换背景、放设置入口

- 品牌位是 `sidebar.brand.mark` 与 `sidebar.brand.name` 两个 single slot。**同优先级重复注册会直接抛错**（`single slot ... already has a registration at priority 0`），要覆盖随附的 `ui-brand-official` 必须显式降低优先级，例如 `ctx.slots.register({ name, priority: -1 }, …)`——数字越小越靠前，撤销自己的注册后官方品牌会自动露出来。这也是「关闭插件即恢复官方外观」能成立的原因，不要再去补丁里 `disabled` 官方品牌包。
- 可选服务用 `ctx.get('theme')` 读取，**不要写 `ctx.theme`**：没有在 `inject` 里声明就直接读属性会抛 `cannot get property "theme" without inject`，把后面的注册整段跳过。需要硬依赖时才在插件 `inject` 里声明；声明后插件停用再启用时，若服务解析异常会导致插件再也挂不回来。
- 品牌和皮肤这类会影响全局的初始化，先注册设置页、再用 try/catch 包住皮肤部分，并把错误显示在设置页里，否则一处失败就只剩「入口消失」这种无从排查的现象。
- 全应用背景不要写死颜色：把每种效果写成 `body[data-dsh-aurora-effect="..."]` 上的自定义属性（`--aurora-*`），组件只切换 `data-*`；壁纸用 `body.style.setProperty('--dsh-aurora-wall', 'url(...)')` 注入，避免每次输入都重写一整段 CSS。背景层用 `body::before` 的 `position: fixed; inset: -6%; z-index: -1`，同时把 `--dsw-alias-bg-base` 等 token 调成半透明，光效才能从面板下面透出来。压暗层只叠在壁纸上，否则会把自带光效冲成白色。
- 插件设置页用 `settings.section`（`id` 与 `settings.section.icon` 相同才会显示导航图标），不要放常驻按钮：窗口最顶部的 **应用 / 编辑** 菜单由桌面端 Electron 主进程的 `Menu.setApplicationMenu` 生成，插件没有注册接口，只能选设置页或某个已有菜单的扩展位。
- 确实需要浮层时注册到 `shell.overlay`，用 `getBoundingClientRect()` 跟着触发按钮定位；`Escape` 和遮罩关闭，关闭时把焦点还给按钮。

## 这次的白屏怎么查

1.0.0 的会话选择器把 `workspaces.list.subscribe` 和 `workspaces.list.getSnapshot` 直接传给了 React。这个数据源由类实例实现，方法内部使用 `this`，被 React 独立调用时会抛异常。测试里的数据源原先是箭头函数，掩盖了这个差异。 [工作区数据源实现](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/api/workspace-controller/src/client/model.ts)

以后接外部状态时，先检查方法的接收者要求。需要订阅时，用稳定的包装函数显式调用 `source.subscribe(listener)` 和 `source.getSnapshot()`。测试替身也要保留相同的接收者要求。待办 1.1.0 用后台会话取代选择器，页面只订阅自己的存储。

## 版本与发布前检查

- 保留已有任务的存储键和字段兼容性。当前待办键是 `@local/dsh-todo-list:v1`，1.1.0 给旧数据添加了可选发送记录。安装目录与本机 Harness 存档分别管理。
- 运行 `pnpm test`。重点核对打开页面、写入和重载、本机缺少默认工作区时的提示、请求失败后的重试 ID，以及发送完成后页面停留。
- 在目标桌面端重新安装，确认入口出现。用一条测试待办派发，检查默认工作区出现对应会话、会话里有完整消息、待办页保持打开。停用后检查入口消失，重新启用后检查原数据可读。
- 提交前用 `git status --short` 检查范围。源码、说明、锁文件和测试进仓库。本机待办、会话日志、凭据、依赖目录和上游源码副本留在仓库之外。准备公开发布时先选定许可和包名，再验证发布产物在目标版本里的安装。
