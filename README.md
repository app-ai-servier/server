# Project List

一个简单的项目列表应用：REST API + 网页界面，零依赖（仅需 Node.js ≥ 18），数据保存在本地 JSON 文件中。

## 运行

```bash
npm start            # http://localhost:3000
npm test             # 运行测试
```

环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 监听端口 |
| `DATA_FILE` | `./data/projects.json` | 数据文件路径 |

## API

项目字段：`id`、`name`（必填）、`description`、`status`（`planned` / `active` / `done`，默认 `planned`）、`createdAt`、`updatedAt`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/projects` | 列出所有项目 |
| POST | `/api/projects` | 创建项目 |
| GET | `/api/projects/:id` | 获取单个项目 |
| PUT/PATCH | `/api/projects/:id` | 更新项目（部分字段即可） |
| DELETE | `/api/projects/:id` | 删除项目 |

## 结构

```
src/server.js   HTTP 服务与路由
src/store.js    JSON 文件存储与校验
public/         网页界面
test/           测试
```
