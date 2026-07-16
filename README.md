# DreamCanvas

DreamCanvas 是一个面向 Web 和 Android 的跨平台 AI 图片生成应用原型，基于 React、TypeScript、Vite 与 Capacitor 构建。

当前版本已经完成移动端创作界面、画面比例选择、历史与设置入口、状态栏适配以及 Android 原生工程基础。图像生成接口、历史记录持久化、图片保存与分享仍在开发中。

## 技术栈

- React 19
- TypeScript 5
- Vite 6
- Capacitor 7
- Android SDK 35

## 本地开发

需要 Node.js 20 或更高版本，以及 pnpm 11。

```powershell
pnpm install
pnpm dev
```

生成 Web 产物：

```powershell
pnpm build
```

## Android

Android 构建需要 JDK 21 和 Android SDK 35。同步 Web 产物与 Capacitor 配置：

```powershell
pnpm cap:sync
```

随后可在 Android Studio 中打开 `android` 目录，或在 JDK 21 环境下构建 debug APK：

```powershell
Set-Location android
.\gradlew.bat assembleDebug
```

## 当前状态

- [x] 移动端响应式界面与安全区适配
- [x] 提示词输入与画面比例选择
- [x] Capacitor Android 工程与状态栏适配
- [ ] 接入图像生成 API
- [ ] 历史记录与本地持久化
- [ ] 图片保存、分享与异常处理

> 当前项目处于原型开发阶段，不包含生产环境 API 密钥或正式发布签名。
