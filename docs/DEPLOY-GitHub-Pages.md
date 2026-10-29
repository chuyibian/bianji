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
- GitHub Pages 对所有文件统一缓存 10 分钟，所以推送后最多等 10 分钟新文件才能下载到。
- 手机上：打开 app 一次，它会在后台下载新版本，**第二次打开时生效**。
- 修改了 CSS 或 JS 的话，顺手把 `public/sw.js` 第 2 行的版本号加一（例如 `bianji-v4` → `bianji-v5`），这样旧缓存会被清掉。

## 如何运作

| 文件 | 作用 |
|---|---|
| `.github/workflows/pages.yml` | 每次推送到 `main` 分支时，把 `public/` 发布到 Pages |
| `public/` | 整个网站，没有构建步骤 |
| `public/edgeone.json` | 只对 EdgeOne 有效，GitHub Pages 会忽略它 |

## 免费额度

站点空间 1GB，每月约 100GB 流量，个人使用远远够用。
