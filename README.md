# AI 智能同传助手

第一阶段已完成项目初始化，当前仓库采用前后端分离结构：

- `frontend/`：Next.js Web App，负责实时界面、麦克风采集与后续 WebSocket 通信。
- `backend/`：FastAPI 服务，负责配置接口、会话初始化与后续 STT/翻译/笔记编排。
- `.trae/documents/`：PRD 与技术架构文档。

## 当前目录结构

```text
English_interpreter/
├─ .trae/documents/
├─ backend/
│  ├─ app/
│  │  ├─ api/
│  │  ├─ core/
│  │  └─ models/
│  └─ requirements.txt
├─ frontend/
│  ├─ src/app/
│  ├─ src/components/
│  ├─ src/features/interpreter/
│  ├─ src/lib/
│  └─ src/types/
└─ .env.example
```

## 本地启动

### 前端

```bash
cd frontend
npm install
npm run dev
```

### 后端

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## 下一步

- 第二步将实现三栏静态 UI。
- 同时加入麦克风权限获取、主题切换与页面状态管理。
