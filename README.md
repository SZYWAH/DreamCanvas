# DreamCanvas

[GitHub 主页](https://github.com/SZYWAH) · [Android 构建](#android) · [功能状态](#当前状态)

DreamCanvas 是一个面向 Web 和 Android 的跨平台 AI 图片生成应用，基于 React、TypeScript、Vite 与 Capacitor 构建。应用将图片供应商和文本供应商完全分开：两类供应商各自支持多个配置、独立地址、独立密钥和独立当前项，图片模型固定使用 `gpt-image-2`。

当前版本支持标准/2K/4K（或最大）分辨率、Low/Medium/High/Auto 画质、独立文本模型润色、本地历史、应用内原图缩放，以及保存到 Android `DreamCanvas` 系统相册。创作页可快速切换图片供应商、文本供应商和文本模型；像素尺寸通过图片请求的 `size` 参数传递，不会伪装成提示词规格。界面默认采用纯黑暗色主题，也可在设置中切换亮色主题。

## 项目概况

- 定位：面向 Web 和 Android 的 AI 图片创作应用。
- 当前源码版本：**1.0.4**，以 [package.json](package.json) 为准。
- 交付方式：当前仓库未发布 GitHub Release；Web 与 Android 构建步骤见下文。

## 技术栈

- React 19
- TypeScript 5
- Vite 6
- Capacitor 7
- Android SDK 35
- Vitest + React Testing Library

## 本地开发

需要 Node.js 20 或更高版本，以及 pnpm 11。

```powershell
pnpm install
pnpm dev
```

生成 Web 产物：

```powershell
pnpm build
pnpm test
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
- [x] 图片与文本双供应商体系、独立密钥、验证与快速切换
- [x] `gpt-image-2` 比例、真实分辨率与画质参数
- [x] 使用上游文本模型进行提示词润色并由用户确认
- [x] 历史记录、本地原图、全屏缩放与相册保存
- [x] 暗色与亮色主题、Android 状态栏和系统导航栏同步
- [x] DC 组合标志、自适应图标、主题图标与黑色启动页

## 密钥与本地数据

- Android 图片密钥与文本密钥分别存储于系统 Keystore 支持的安全存储中；配置和历史不包含密钥。
- Web 两类密钥均仅存于当前浏览器会话，关闭会话后需要重新输入。
- Android 原图写入应用私有目录，保存到系统相册后会生成独立副本。
- 历史最多保留 24 条，并按平台执行原图字节预算清理。

> 仓库不包含任何真实 API 密钥或正式发布签名。不同中转上游对实验尺寸的透传能力可能不同，请以应用内真实请求结果为准。

