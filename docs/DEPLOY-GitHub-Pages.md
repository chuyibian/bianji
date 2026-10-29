# 便记：GitHub Pages 部署与安装

**网址：https://chuyibian.github.io/bianji/**
**仓库：https://github.com/chuyibian/bianji**（公开。仓库里只有 app 代码；你的记录只存在手机上，不会上传）

---

## 装到 iPhone（只需做一次）

1. 用 **Safari** 打开 https://chuyibian.github.io/bianji/ （必须用 Safari）
2. 点底部的**分享**按钮 → **添加到主屏幕** → **添加**
3. 以后都从主屏幕的小猫图标打开：全屏运行，离线也能用

安卓：用 Chrome 打开 → 右上角菜单 → **安装应用**。

> 记录是跟着这个网址保存的。以后如果更换网址（比如改仓库名，或换到 EdgeOne），请先在「数据 → 导出备份」导出，到新网址再导入。

---

## 以后怎么更新

修改 `public/` 里的文件后，在项目目录里提交并推送：

```bash
cd /Users/chuyibian/Projects/poop && git add -A && git commit -m "更新" && git push
```

- 推送后，GitHub Actions 会自动把 `public/` 发布出去，大约 1 分钟完成。可以在仓库的 **Actions** 页面查看进度。
- **每次发布都要把 `public/sw.js` 第 3 行的版本号加一**（例如 `bianji-v7` → `bianji-v8`）。手机正是靠这个版本号的变化发现新版本的。
- 手机上：只要联网，每次打开或切回 app 都会检查新版本；发现后自动刷新一次，不需要做任何操作。离线时使用上次缓存的版本。
- 想确认手机上是哪个版本：看「数据」页最底部的「版本 bianji-vN」。

## 如何运作

| 文件 | 作用 |
|---|---|
| `.github/workflows/pages.yml` | 每次推送到 `main` 分支时，把 `public/` 发布到 Pages |
| `public/` | 整个网站，没有构建步骤 |
| `public/edgeone.json` | 只对 EdgeOne 有效，GitHub Pages 会忽略它 |

## 免费额度

站点空间 1GB，每月约 100GB 流量，个人使用远远够用。
