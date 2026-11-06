<p align="center">
  Windows 平台《明日方舟》Mod 管理器：角色库、Mod 下载、文本/AB 包 MOD、加载器与运行时资源管理。
</p>

## 范围

本分支仅保留明日方舟相关功能。其他游戏的入口、服务、设置页面、XXMI/EFMI/Steam 组件与资源均已移除。

## MEGA 下载组件

市场下载使用 `bridges/mega` 子模块（[QAQ-Revival/MEGA-Worker](https://github.com/QAQ-Revival/MEGA-Worker.git)）：

```bat
git submodule update --init --recursive bridges/mega
node tools/build-mega.cjs
```

构建产物位于 `app/resources/mega-worker`，随应用一起打包。
