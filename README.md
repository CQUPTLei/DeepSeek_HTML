# DeepSeek_HTML

**English version：** [README_EN.md](https://github.com/CQUPTLei/DeepSeek_HTML/blob/master/README_EN.md)

---

☘️ **项目地址**：[https://github.com/CQUPTLei/DeepSeek_HTML/tree/master](https://github.com/CQUPTLei/DeepSeek_HTML/tree/master)

**对话截图：**
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/8385e5db9e44449799820314dc69e017.png )

# 一、项目结构

```bash
C:\USERS\14134\DESKTOP\DEEPSEEK
│  .gitignore 
│  DeepSeek.html  # 所有代码放一个文件（不推荐）
│  index.html     # 网页启动文件
│  README.md      # readme
│
├─chat_history
│      example.json  # 聊天记录
│
├─css
│      style.css    # 样式
│
└─js
        config.js         	# 配置
        config_example.js	# 配置示例
        function.js			# 主要功能实现
```

# 二、功能支持

- `deepseek`的 `V3`模型、`R1`模型；
- 多轮对话；
- 流式输出；
- 对话保存为`json`文件。
- `markdown` 渲染；
- 公式渲染；
- 复制输出为markdown格式。
# 三、使用方法

1. 克隆项目到本地：

```bash
git clone git@github.com:CQUPTLei/DeepSeek_HTML.git
```
Download Zip也可以的。

2. 到 deepseek 开放平台充值，申请api key ：[https://platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)
	- 这个价格挺便宜的 ，我用了6万token才3毛钱。
3. 复制api key，粘贴到：`js/config_example.js`中相应位置。将该文件改名为：`config.js`。
4. 在`chat_history`目录下新建一个空的`json`文件，或者用`example.json`也可以。
5. 运行index.html，安装提示选择聊天保存的位置即可。

> **注：目前仅支持`Chrome`浏览器和`edge`浏览器。**

# 四、待改进

1. 输出渲染优化；
2. 文件存储逻辑需要优化；
3. 推理模型的推理过程输出。

# 五、参数优化

自己看deepseek的开发文档即可：[https://api-docs.deepseek.com/zh-cn/](https://api-docs.deepseek.com/zh-cn/)

* 出于与 OpenAI 兼容考虑，您也可以将 base_url 设置为 `https://api.deepseek.com/v1` 来使用，但注意，此处 v1 与模型版本无关。

* deepseek-chat 模型已全面升级为 DeepSeek-V3，接口不变。 通过指定 model='deepseek-chat' 即可调用 DeepSeek-V3。

* deepseek-reasoner 是 DeepSeek 最新推出的推理模型 DeepSeek-R1。通过指定 model='deepseek-reasoner'，即可调用 DeepSeek-R1。
