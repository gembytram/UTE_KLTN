const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, UnderlineType
} = require('docx');
const fs = require('fs');

const data = JSON.parse(process.argv[2] || '{}');
const {
  tenDeTai = '',
  sinhVien = '',
  maSV = '',
  topicType = '',
  vaiTro = '',
  roleLabel = '',
  nguoiCham = '',
  diem = '',
  nhanXet = '',
  cauHoi = '',
  criteria = [],
  criteriaNames = [],
  criteriaMax = [],
  total = 0,
  ngay = '',
  thang = '',
  nam = '',
} = data;

const noBorder = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 },
};

function txt(text, opts = {}) {
  return new TextRun({ text: text || '', font: 'Times New Roman', size: 24, ...opts });
}
function bold(text, opts = {}) {
  return txt(text, { bold: true, ...opts });
}
function leftPara(children = [], spacing = {}) {
  return new Paragraph({ alignment: AlignmentType.LEFT, children, spacing: { before: 0, after: 0, ...spacing } });
}
function centerPara(children = [], spacing = {}) {
  return new Paragraph({ alignment: AlignmentType.CENTER, children, spacing: { before: 0, after: 0, ...spacing } });
}
function multiline(text) {
  const lines = (text || '').split('\n');
  return lines.length ? lines.map((line) => leftPara([txt(line)])) : [leftPara([txt('')])];
}
function criteriaRow(name, max, value) {
  return new TableRow({
    children: [
      new TableCell({ borders: noBorder, width: { size: 2600, type: WidthType.DXA }, children: [leftPara([txt(name || '')])] }),
      new TableCell({ borders: noBorder, width: { size: 1600, type: WidthType.DXA }, children: [leftPara([txt(max !== null && max !== undefined ? String(max) : '')]) ] }),
      new TableCell({ borders: noBorder, width: { size: 2600, type: WidthType.DXA }, children: [leftPara([txt(value !== null && value !== undefined ? String(value) : '')]) ] }),
    ],
  });
}

const doc = new Document({
  sections: [
    {
      properties: { page: { margin: { top: 850, right: 850, bottom: 850, left: 850 } } },
      children: [
        centerPara([bold('BÁO CÁO CHẤM ĐIỂM KHÓA LUẬN TỐT NGHIỆP')], { before: 200, after: 200 }),
        leftPara([bold('Tên đề tài: '), txt(tenDeTai || '.......................................................')], { after: 120 }),
        leftPara([bold('Sinh viên: '), txt(sinhVien || '.......................................................')], { after: 120 }),
        leftPara([bold('MSSV: '), txt(maSV || '.......................................................')], { after: 120 }),
        leftPara([bold('Loại đề tài: '), txt(topicType || '.......................................................')], { after: 120 }),
        leftPara([bold('Vai trò chấm điểm: '), txt(roleLabel || vaiTro || '.......................................................')], { after: 120 }),
        leftPara([bold('Người chấm điểm: '), txt(nguoiCham || '.......................................................')], { after: 120 }),
        leftPara([bold('Điểm tổng: '), txt(diem !== '' ? String(diem) : String(total))], { after: 120 }),
        leftPara([bold('Tiêu chí chi tiết:')], { before: 200, after: 120 }),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          rows: [
            new TableRow({
              children: [
                new TableCell({ borders: noBorder, width: { size: 2600, type: WidthType.DXA }, children: [leftPara([bold('Tiêu chí')])], }),
                new TableCell({ borders: noBorder, width: { size: 1600, type: WidthType.DXA }, children: [leftPara([bold('Điểm tối đa')])], }),
                new TableCell({ borders: noBorder, width: { size: 2600, type: WidthType.DXA }, children: [leftPara([bold('Điểm')])], }),
              ],
            }),
            ...criteria.map((value, index) => {
              const name = criteriaNames[index] || `Tiêu chí ${index + 1}`;
              const max = criteriaMax[index] != null ? criteriaMax[index] : '';
              return criteriaRow(name, max, value ?? '');
            }),
            new TableRow({
              children: [
                new TableCell({ borders: noBorder, width: { size: 2600, type: WidthType.DXA }, children: [leftPara([bold('Tổng điểm (0-10)')])], }),
                new TableCell({ borders: noBorder, width: { size: 1600, type: WidthType.DXA }, children: [leftPara([txt('10')])], }),
                new TableCell({ borders: noBorder, width: { size: 2600, type: WidthType.DXA }, children: [leftPara([txt(String(total))])], }),
              ],
            }),
          ],
        }),
        leftPara([bold('Nhận xét/chú giải:')], { before: 200, after: 120 }),
        ...multiline(nhanXet || '...'),
        ...(cauHoi ? [leftPara([bold('Góp ý / câu hỏi:'), txt('')]), ...multiline(cauHoi)] : []),
        leftPara([txt(`Ngày ${ngay || '__'} tháng ${thang || '__'} năm ${nam || '____'}`)], { before: 240, after: 120 }),
        leftPara([txt('Chữ ký người chấm điểm: _________________________________')], { before: 120 }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(process.argv[3], buffer);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});