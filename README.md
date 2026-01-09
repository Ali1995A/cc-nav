# CC 导航页

一个本地可用/可部署的「CC 专属导航页」：默认 12 个链接（可自行增删），粉色卡通 + iOS 审美，大图标卡片，iPad/微信内置浏览器更友好。

## 使用

- 直接打开：`index.html`
- 或在 PowerShell 里：`Start-Process .\\index.html`

## 配置链接

编辑：`links.json`

- `items[]`：链接项（`title` / `url` / `icon`）

本地路径示例（Windows）：

```json
{ "title": "3DCC", "url": "file:///D:/Soft/MyCode/3DCC" }
```

## Vercel 部署

- 直接把仓库导入 Vercel 即可（静态站点，无需构建）。
- 如需「单页应用」式回退，项目已提供 `vercel.json`。
