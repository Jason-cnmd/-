// ============================================================
// 数据库学习乐园 - GitHub 连接配置（必需！）
// 本版本不再使用外部数据库，所有数据（账号、学生档案、成绩）
// 都以"文件"形式保存在你的 GitHub 仓库里，每人一个数据文件。
// 因此必须填写下面的内容，否则网页无法登录和使用。
//
// 填写方法：
//   1. 登录 GitHub，点右上角头像 -> Settings
//      -> 最下方 Developer settings -> Personal access tokens
//      -> Fine-grained tokens -> Generate new token
//   2. 填写：
//      - Token name：随意，如 class-token
//      - Repository access：Only select repositories，勾选本项目仓库
//      - Permissions -> Contents：Read and write
//   3. 点 Generate token，立刻复制生成的令牌（形如 github_pat_...，只显示一次！）
// ============================================================

// ① 你的 GitHub 用户名（Owner）
const GITHUB_OWNER = "Jason-cnmd";

// ② 本项目的仓库名（Repository）
const GITHUB_REPO = "数据库";

// ③ Fine-grained 访问令牌（只给本项目仓库 Contents 读写权限即可）
const GITHUB_TOKEN = "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";

// ④ 数据文件存放目录（默认 data，一般不用改）
//    账号、学生档案、成绩文件都保存在这个目录下
const GITHUB_FOLDER = "data";
