# -*- coding: utf-8 -*-
"""
生成《数据库学习乐园 · 学生使用说明.docx》到桌面
双击运行本脚本即可（需要电脑装有 Python 3）。
生成的文档与网页内容一一对应，可发给学生打印或阅读。
"""
import zipfile
import os
import sys

# ---------- XML 转义 ----------
def esc(s):
    return (s.replace('&', '&amp;')
             .replace('<', '&lt;')
             .replace('>', '&gt;'))

# ---------- docx 构建工具 ----------
def para(text, style=None, bold=False, size=None, color=None, mono=False):
    """生成一个段落 XML"""
    ppr = ''
    rpr = ''
    if style:
        ppr += f'<w:pStyle w:val="{style}"/>'
    if bold or size or color or mono:
        rpr += '<w:rPr>'
        if bold:
            rpr += '<w:b/>'
        if mono:
            rpr += '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:eastAsia="微软雅黑"/>'
        if size:
            rpr += f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/>'
        if color:
            rpr += f'<w:color w:val="{color}"/>'
        rpr += '</w:rPr>'
    return (f'<w:p><w:pPr>{ppr}</w:pPr>'
            f'<w:r>{rpr}<w:t xml:space="preserve">{esc(text)}</w:t></w:r></w:p>')

def table(rows):
    """rows: list of list of str"""
    xml = ('<w:tbl><w:tblPr>'
           '<w:tblStyle w:val="TableGrid"/>'
           '<w:tblW w:w="0" w:type="auto"/>'
           '<w:tblBorders>'
           '<w:top w:val="single" w:sz="4" w:color="BFBFBF"/>'
           '<w:left w:val="single" w:sz="4" w:color="BFBFBF"/>'
           '<w:bottom w:val="single" w:sz="4" w:color="BFBFBF"/>'
           '<w:right w:val="single" w:sz="4" w:color="BFBFBF"/>'
           '<w:insideH w:val="single" w:sz="4" w:color="BFBFBF"/>'
           '<w:insideV w:val="single" w:sz="4" w:color="BFBFBF"/>'
           '</w:tblBorders></w:tblPr>')
    for i, row in enumerate(rows):
        xml += '<w:tr>'
        for cell in row:
            bold = (i == 0)
            shade = '<w:shd w:val="clear" w:color="auto" w:fill="EEF2FF"/>' if i == 0 else ''
            xml += ('<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/>' + shade + '</w:tcPr>'
                    + para(cell, bold=bold) + '</w:tc>')
        xml += '</w:tr>'
    xml += '</w:tbl>'
    return xml

def spacer():
    return '<w:p/>'

# ---------- 文档内容 ----------
C = []
C.append(para('数据库学习乐园 · 学生使用说明', 'Title'))
C.append(para('这是一个教学平台。你的账号、档案和成绩都以「文件」形式保存在 GitHub 仓库里，每个人一个数据文件。你需要用「邮箱 + 密码」注册登录，登录后网页只加载你自己的数据。', bold=True))
C.append(spacer())

# 一
C.append(para('一、第一次使用：注册账号', 'Heading1'))
C.append(para('1. 打开老师发的网址，进入登录页面。'))
C.append(para('2. 点击「注册」标签，填写：'))
C.append(table([
    ['项目', '怎么填'],
    ['邮箱', '你自己的邮箱（例如 wangxiaoming@stu.example.com）'],
    ['密码', '自己设置，至少 4 位，要记住'],
]))
C.append(para('3. 点击「注册」按钮。提示注册成功、自动进入系统，就完成啦！'))
C.append(spacer())

# 二
C.append(para('二、以后怎么登录', 'Heading1'))
C.append(para('1. 打开网址，输入注册时的邮箱和密码。'))
C.append(para('2. 点「登录」。登录后右上角会显示你的名字和邮箱。'))
C.append(para('3. 关掉网页再打开，会自动保持登录；也可以点右上角「退出登录」。'))
C.append(spacer())

# 三
C.append(para('三、界面上的东西怎么用', 'Heading1'))
C.append(table([
    ['位置', '是什么', '怎么用'],
    ['左侧「数据库中的表」', '三张"虚拟表"：students（我的档案）、courses（课程）、scores（我的成绩）', '点一下表名，SQL 编辑器会自动填入查询并执行。注意：档案和成绩是你自己的，课程是全班共享的'],
    ['我的资料', '你自己的档案', '修改姓名、性别、班级后点「保存修改」，会写进你的数据文件'],
    ['登记我的成绩', '给自己加一条成绩', '选课程、填 0~100 的成绩，点「登记成绩」，成绩表立刻多一行'],
    ['SQL 编辑器', '写 SQL 的地方', '照着下方「SQL 示例」点一下，SQL 就自动填进去；也可以自己输入，然后点「执行」'],
    ['SQL 示例', '10 个现成的查询', '点任意一个，自动填入编辑器并执行，看结果'],
    ['制作我的专属网页', '把自己的成绩变成网页', '输入名字，点「生成我的专属网页」，稍等 1~2 分钟点链接就能看到'],
]))
C.append(spacer())

# 四
C.append(para('四、SQL 查询快速入门', 'Heading1'))
C.append(para('SQL 是"和数据库对话"的语言。每条 SQL 以分号（;）结尾。本环境支持基础 SELECT 查询。', bold=True))
C.append(table([
    ['想做什么', '怎么写', '说明'],
    ['看全部数据', 'SELECT * FROM students;', '* 表示"所有列"；students 是你的档案'],
    ['只看某些列', 'SELECT name, class_name FROM students;', '只显示姓名和班级'],
    ['筛选条件', "SELECT course, score FROM scores WHERE score >= 90;", 'WHERE 后面写条件；分数用数字，文字要加单引号'],
    ['排序', 'SELECT course, score FROM scores ORDER BY score DESC;', 'ORDER BY 排序，DESC 从大到小'],
    ['限制条数', 'SELECT course, score FROM scores ORDER BY score DESC LIMIT 3;', '只显示前 3 行'],
    ['模糊查找', "SELECT * FROM courses WHERE name LIKE '%语%';", '% 表示"任意内容"'],
    ['统计', 'SELECT COUNT(*) AS 科目数, AVG(score) AS 平均分 FROM scores;', 'COUNT 数量、AVG 平均、MAX 最大、MIN 最小'],
]))
C.append(spacer())

# 五
C.append(para('五、课堂任务（跟着做）', 'Heading1'))
C.append(para('任务 1：查看我的档案', bold=True))
C.append(para('点击左侧「students」表，确认你只看到自己的一行数据。然后在编辑器输入：', ))
C.append(para("SELECT * FROM students;", mono=True))
C.append(para('任务 2：查看我的成绩单', bold=True))
C.append(para('点「SQL 示例」里的「成绩排序 ORDER BY」，再点「执行」，看看自己每门课的成绩从高到低。'))
C.append(para('任务 3：登记成绩 + 制作网页', bold=True))
C.append(para('1. 在「登记我的成绩」里，选一门课、填一个成绩，点「登记成绩」。'))
C.append(para('2. 重新执行「成绩排序 ORDER BY」，确认新成绩出现了（数据真实保存在你的文件里！）。'))
C.append(para('3. 点「制作我的专属网页」，输入你的名字，生成后把网址分享给同学。'))
C.append(spacer())

# 六
C.append(para('六、常见问题', 'Heading1'))
C.append(table([
    ['问题', '怎么办'],
    ['提示"邮箱或密码错误"', '检查邮箱、密码有没有输错；忘了密码请联系老师'],
    ['提示"该邮箱已注册"', '你之前注册过，直接点「登录」'],
    ['查询出错，出现红字', '红字是中文提示，按提示修改 SQL；例如"表不存在"可能是表名写错了'],
    ['想删除一条成绩', '成绩表每行后面有「删除」按钮，点一下即可'],
    ['换台电脑登录', '数据都在云端仓库里，用同一邮箱密码登录即可看到'],
]))
C.append(spacer())

# 七
C.append(para('七、给老师的备忘', 'Heading1'))
C.append(para('· 部署：按项目内 README.md 操作（填 github-config.js → 上传仓库 → 开启 GitHub Pages），无需任何外部数据库服务。'))
C.append(para('· 账号：学生用「邮箱 + 密码」注册；账号存在 data/_accounts.json。'))
C.append(para('· 数据：每个学生的档案和成绩存在 data/<邮箱>.json（邮箱中的 @、. 会变成下划线，如 wangxiaoming@stu.com → wangxiaoming_stu_com.json）。'))
C.append(para('· 重置：删除 data/ 下生成的个人文件，并把 _accounts.json 内容清回 [] 即可（学生需重新注册）。'))
C.append(para('· 提醒学生：令牌公开在网页源码中，请勿乱动别人的文件、勿同时开两个窗口操作。'))

# ---------- 组装 document.xml ----------
body = ''.join(C)
document_xml = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    f'<w:body>{body}'
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
    '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>'
    '</w:body></w:document>'
)

content_types = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/>'
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
    '</Types>'
)

rels = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    '</Relationships>'
)

doc_rels = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    '</Relationships>'
)

styles_xml = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    '<w:docDefaults><w:rPrDefault><w:rPr>'
    '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="微软雅黑"/>'
    '<w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>'
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/>'
    '<w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/>'
    '<w:pPr><w:spacing w:before="240" w:after="240"/><w:jc w:val="center"/></w:pPr>'
    '<w:rPr><w:b/><w:sz w:val="44"/><w:szCs w:val="44"/><w:color w:val="3B55D4"/></w:rPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/>'
    '<w:pPr><w:spacing w:before="240" w:after="120"/><w:keepNext/></w:pPr>'
    '<w:rPr><w:b/><w:sz w:val="30"/><w:szCs w:val="30"/><w:color w:val="3B55D4"/></w:rPr></w:style>'
    '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/>'
    '<w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>'
    '</w:styles>'
)

# ---------- 输出 ----------
desktop = os.path.join(os.path.expanduser('~'), 'Desktop')
out_path = os.path.join(desktop, '数据库学习乐园-学生使用说明.docx')

try:
    with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', content_types)
        z.writestr('_rels/.rels', rels)
        z.writestr('word/document.xml', document_xml)
        z.writestr('word/_rels/document.xml.rels', doc_rels)
        z.writestr('word/styles.xml', styles_xml)
    print('生成成功：' + out_path)
except Exception as e:
    print('生成失败：' + str(e))
    sys.exit(1)
