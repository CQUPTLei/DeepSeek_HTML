# DeepSeek_HTML

**Simplified Chinese instructions**: [README_CN.md](https://github.com/CQUPTLei/DeepSeek_HTML/README.md)

☘️ **Project Address**: [https://github.com/CQUPTLei/DeepSeek_HTML/tree/master](https://github.com/CQUPTLei/DeepSeek_HTML/tree/master)

**Conversation Screenshot:**
![Insert Image Description Here](https://i-blog.csdnimg.cn/direct/8385e5db9e44449799820314dc69e017.png)

# 1. Project Structure

```bash
C:\USERS\14134\DESKTOP\DEEPSEEK
│  .gitignore 
│  DeepSeek.html  # All code in one file (not recommended)
│  index.html     # Webpage launch file
│  README.md      # readme
│
├─chat_history
│      example.json  # Chat history
│
├─css
│      style.css    # Styles
│
└─js
        config.js         	# Configuration
        config_example.js	# Configuration example
        function.js			# Main functionality implementation
```

# 2. Supported Features

- `DeepSeek`'s `V3` model and `R1` model;
- Multi-turn dialogue;
- Streaming output;
- Save conversations as `json` files.
- `Markdown` rendering;
- Formula rendering;
- Copy output as markdown format.

# 3. Usage Instructions

1. Clone the project locally:

```bash
git clone git@github.com:CQUPTLei/DeepSeek_HTML.git
```

Downloading the Zip file is also acceptable.

2. Go to the DeepSeek open platform to recharge and apply for an API key: [https://platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)
   - The price is quite affordable; I used 60,000 tokens for only 0.3 yuan.
3. Copy the API key and paste it into the appropriate location in: `js/config_example.js`. Rename this file to: `config.js`.
4. Create a new empty `json` file in the `chat_history` directory, or use `example.json` as well.
5. Run index.html and follow the prompts to select where to save the chat.

> **Note: Currently only supports `Chrome` and `Edge` browsers.**

# 4. Areas for Improvement

1. Output rendering optimization;
2. File storage logic needs optimization;
3. Output of the reasoning process of the inference model.

# 5. Parameter Optimization

Refer to the DeepSeek development documentation: [https://api-docs.deepseek.com/zh-cn/](https://api-docs.deepseek.com/zh-cn/)

* For compatibility with OpenAI, you can also set base_url to `https://api.deepseek.com/v1` to use, but note that v1 here is not related to the model version.

* The deepseek-chat model has been fully upgraded to DeepSeek-V3, with no changes to the interface. By specifying model='deepseek-chat', you can call DeepSeek-V3.

* deepseek-reasoner is the latest reasoning model from DeepSeek, DeepSeek-R1. By specifying model='deepseek-reasoner', you can call DeepSeek-R1.