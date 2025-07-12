# AIworkflow_Appscript
This is a simple html UI which construct AI workflow and call gemini api with google app script

这个玩意不能满足我的需求，已经跑路，不改了

# 使用
需要构建google app script项目，将index.html与google app script.gs添加到项目中

需要申请gemini api key，填入项目

# 用法
保存和载入采用样例格式的json

“执行当前”会将选中节点的输入和描述作为参数给大模型，结果通过替换保存在当前节点的内容当中

“标准”模式调用gemini-2.5-flash

“快速”模式调用gemini-2.0-flash

“难题”模式调用gemini-2.5-pro

“执行全部”按照顺序调用节点，不支持环路

勾选“历史记录”时，节点内容也会作为参数给大模型，返回结果将附加在末尾

