const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  WidthType,
  TabStopType,
} = require('docx');
const fs = require('fs');

const data = JSON.parse(process.argv[2]);

const {
  tenKhoa = '',
  tenDeTai = '',
  sinhVien = '',
  maSV = '',
  diemGVHD = '',
  diemGVPB = '',
  diemHoiDongTB = '',
  diemTongHop = '',
  diemThanhVien = '',
  tenGVHD = '',
  tenGVPB = '',
  tenChuTich = '',
  nhanXetCT = '',
  nhanXetTV = '',
  yeuCauChinhSua = '',
  chuTichHD = '',
  thuKy = '',
  chuTichSauChinhSua = '',
  ngay = '',
  thang = '',
  nam = '',
  ngay2 = '',
  thang2 = '',
  nam2 = '',
  khoaHoc = '',
} = data;

const noBorder = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 },
};

const whiteBorder = {
  top: { style: BorderStyle.SINGLE, size: 1, color: 'FFFFFF' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'FFFFFF' },
  left: { style: BorderStyle.SINGLE, size: 1, color: 'FFFFFF' },
  right: { style: BorderStyle.SINGLE, size: 1, color: 'FFFFFF' },
};

const CONTENT_WIDTH = 9666;
const CONTENT_GUTTER = 220;

function txt(text, opts = {}) {
  return new TextRun({ text, font: 'Times New Roman', size: 24, color: '000000', ...opts });
}

function boldTxt(text, opts = {}) {
  return txt(text, { bold: true, ...opts });
}

function centerPara(children, spacing = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children,
    spacing: { before: 0, after: 0, line: 360, ...spacing },
  });
}

function leftPara(children, spacing = {}) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    children,
    spacing: { before: 0, after: 0, line: 360, ...spacing },
  });
}

function dottedDivider(width = 8600) {
  return new Paragraph({
    children: [txt('')],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '7A7A7A', space: 1 } },
    spacing: { before: 40, after: 120 },
    indent: { left: 0, right: 0 },
    width: { size: width, type: WidthType.DXA },
  });
}

function dottedFillLine(label, value = '') {
  return new Paragraph({
    spacing: { before: 0, after: 20, line: 360 },
    children: [txt(`${label} ${value || ''}`.trimEnd())],
  });
}

function blankDottedLine() {
  return new Paragraph({
    spacing: { before: 0, after: 0, line: 360 },
    children: [txt(' ')],
  });
}

function contentBlock(text, lineCount = 6) {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
  const paras = lines.map((line) =>
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 0, after: 20, line: 360 },
      children: [txt(line, { color: '000000' })],
    })
  );
  while (paras.length < lineCount) {
    paras.push(blankDottedLine());
  }
  return paras;
}

function chairmanOpinionLine() {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    alignment: AlignmentType.CENTER,
    columnWidths: [CONTENT_WIDTH],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'FFFFFF' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'FFFFFF' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'FFFFFF' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'FFFFFF' },
      insideH: { style: BorderStyle.SINGLE, size: 1, color: 'FFFFFF' },
      insideV: { style: BorderStyle.SINGLE, size: 1, color: 'FFFFFF' },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            borders: whiteBorder,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [
              new Paragraph({
                children: [txt('')],
                border: {
                  bottom: {
                    color: '000000',
                    space: 1,
                    style: BorderStyle.DOTTED,
                    size: 6,
                  },
                },
                spacing: { before: 120, after: 0, line: 360 },
                keepLines: true,
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function scoreRow(role, name, score) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 1700, type: WidthType.DXA },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        },
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [centerPara([boldTxt(role)])],
      }),
      new TableCell({
        width: { size: 6166, type: WidthType.DXA },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [leftPara([txt(name || '')])],
      }),
      new TableCell({
        width: { size: 1800, type: WidthType.DXA },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        },
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [centerPara([txt(score || '–')])],
      }),
    ],
  });
}

function mergedScoreRow(label, score) {
  return new TableRow({
    children: [
      new TableCell({
        columnSpan: 2,
        width: { size: 7866, type: WidthType.DXA },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [leftPara([boldTxt(label)])],
      }),
      new TableCell({
        width: { size: 1800, type: WidthType.DXA },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        },
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [centerPara([txt(score || '–')])],
      }),
    ],
  });
}

function parseThanhVienScores() {
  return String(diemThanhVien || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.lastIndexOf(':');
      if (idx < 0) return null;
      const left = line.slice(0, idx).trim();
      const right = line.slice(idx + 1).trim();
      if (!left || ['GVHD', 'GVPB', 'TB Hội đồng', 'Điểm tổng hợp'].includes(left)) return null;
      if (left === 'Chủ tịch HĐ') return { role: 'CT', name: tenChuTich || 'Chủ tịch hội đồng', score: right || '–' };
      return { role: 'TV', name: left, score: right || '–' };
    })
    .filter(Boolean);
}

function scoreTable() {
  const memberRows = parseThanhVienScores();
  const rows = [
    new TableRow({
      children: [
        new TableCell({
          width: { size: 1700, type: WidthType.DXA },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
            left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
            right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          },
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          children: [centerPara([boldTxt('Vai trò')])],
        }),
        new TableCell({
          width: { size: 6166, type: WidthType.DXA },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
            left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
            right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [centerPara([boldTxt('Họ tên / Nội dung')])],
        }),
        new TableCell({
          width: { size: 1800, type: WidthType.DXA },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
            left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
            right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          },
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          children: [centerPara([boldTxt('Điểm')])],
        }),
      ],
    }),
    scoreRow('GVHD', tenGVHD || 'Giảng viên hướng dẫn', diemGVHD || '–'),
    scoreRow('GVPB', tenGVPB || 'Giảng viên phản biện', diemGVPB || '–'),
    ...memberRows.map((row) => scoreRow(row.role, row.name, row.score)),
    mergedScoreRow('Trung bình hội đồng', diemHoiDongTB || '–'),
    scoreRow('Tổng', 'Điểm tổng hợp', diemTongHop || '–'),
  ];

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    alignment: AlignmentType.CENTER,
    columnWidths: [1700, 6166, 1800],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      insideH: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      insideV: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
    },
    rows,
  });
}

function twoColPara(leftText = '', rightText = '', options = {}) {
  const { bold = false, before = 0, after = 0, keepNext = false } = options;
  const maker = bold ? boldTxt : txt;
  return new Paragraph({
    spacing: { before, after, line: 360 },
    keepNext,
    keepLines: true,
    tabStops: [
      { type: TabStopType.LEFT, position: 0 },
      { type: TabStopType.RIGHT, position: 9026 },
    ],
    children: [
      maker(leftText),
      new TextRun({ text: '\t', font: 'Times New Roman', size: 24 }),
      maker(rightText),
    ],
  });
}

function signatureDatePara(d, m, y) {
  return new Paragraph({
    spacing: { before: 140, after: 20, line: 360 },
    keepNext: true,
    keepLines: true,
    tabStops: [
      { type: TabStopType.CENTER, position: 2400 },
      { type: TabStopType.CENTER, position: 6900 },
    ],
    children: [
      new TextRun({ text: '\t', font: 'Times New Roman', size: 24 }),
      new TextRun({ text: '\t', font: 'Times New Roman', size: 24 }),
      txt(`Ngày ${d || '...'} tháng ${m || '...'} năm ${y || '......'}`),
    ],
  });
}

function rightDateLine(d, m, y) {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 140, after: 60, line: 360 },
    keepNext: true,
    children: [
      txt(`Ngày ${d || '...'} tháng ${m || '...'} năm ${y || '......'}`),
    ],
  });
}

function signatureBlock() {
  // Table chữ ký: giữ toàn bộ khối trên cùng một trang và vẫn chừa khoảng ký tên
  return new Table({
    width: { size: 9500, type: WidthType.DXA },
    columnWidths: [4750, 4750],
    rows: [
      new TableRow({
        cantSplit: true,
        tableHeader: true,
        children: [
          new TableCell({
            borders: whiteBorder,
            width: { size: 4750, type: WidthType.DXA },
            children: [
              new Paragraph({
                children: [txt('')],
                spacing: { before: 0, after: 0, line: 360 },
                keepNext: true,
                keepLines: true,
              }),
            ],
          }),
          new TableCell({
            borders: whiteBorder,
            width: { size: 4750, type: WidthType.DXA },
            children: [
              new Paragraph({
                children: [txt(`Ngày ${ngay || '...'} tháng ${thang || '...'} năm ${nam || '......'}`)],
                spacing: { before: 0, after: 0, line: 360 },
                alignment: AlignmentType.CENTER,
                keepNext: true,
                keepLines: true,
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            borders: whiteBorder,
            width: { size: 4750, type: WidthType.DXA },
            children: [centerPara([boldTxt('Chủ tịch hội đồng')], { after: 0 })],
          }),
          new TableCell({
            borders: whiteBorder,
            width: { size: 4750, type: WidthType.DXA },
            children: [centerPara([boldTxt('Thư ký')], { after: 0 })],
          }),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            borders: whiteBorder,
            width: { size: 4750, type: WidthType.DXA },
            children: [centerPara([txt('(ký, họ và tên)')], { after: 0 })],
          }),
          new TableCell({
            borders: whiteBorder,
            width: { size: 4750, type: WidthType.DXA },
            children: [centerPara([txt('(ký, họ và tên)')], { after: 0 })],
          }),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            borders: whiteBorder,
            width: { size: 4750, type: WidthType.DXA },
            children: [
              new Paragraph({
                children: [txt('')],
                spacing: { before: 760, after: 0, line: 360 },
                keepNext: true,
                keepLines: true,
              }),
            ],
          }),
          new TableCell({
            borders: whiteBorder,
            width: { size: 4750, type: WidthType.DXA },
            children: [
              new Paragraph({
                children: [txt('')],
                spacing: { before: 760, after: 0, line: 360 },
                keepNext: true,
                keepLines: true,
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            borders: whiteBorder,
            width: { size: 4750, type: WidthType.DXA },
            children: [centerPara([boldTxt(chuTichHD || '')], { after: 0 })],
          }),
          new TableCell({
            borders: whiteBorder,
            width: { size: 4750, type: WidthType.DXA },
            children: [centerPara([boldTxt(thuKy || '')], { after: 0 })],
          }),
        ],
      }),
    ],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'FFFFFF' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'FFFFFF' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'FFFFFF' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'FFFFFF' },
      insideH: { style: BorderStyle.SINGLE, size: 1, color: 'FFFFFF' },
      insideV: { style: BorderStyle.SINGLE, size: 1, color: 'FFFFFF' },
    },
  });
}

const major = String(tenKhoa || '').trim() || 'KINH DOANH QUỐC TẾ';
const course = String(khoaHoc || '').trim();

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: 'Times New Roman', size: 24 } },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: { top: 1000, right: 900, bottom: 1000, left: 900 },
        },
      },
      children: [
        centerPara([boldTxt('ĐẠI HỌC CÔNG NGHỆ KỸ THUẬT TP.HCM')], { after: 20 }),
        centerPara([boldTxt('KHOA KINH TẾ')]),
        centerPara([boldTxt(`NGÀNH ${major.toUpperCase()}`)], { after: 40 }),
        dottedDivider(),

        centerPara([boldTxt('BIÊN BẢN HỌP HỘI ĐỒNG ĐÁNH GIÁ KHÓA LUẬN TỐT NGHIỆP')], { before: 180, after: 10 }),
        centerPara([boldTxt(`NGÀNH ${major.toUpperCase()} KHÓA ${course || '............................'}`)], { after: 220 }),

        leftPara([boldTxt('1.  Thông tin chung')], { after: 80 }),
        dottedFillLine('Tên khóa luận:', tenDeTai),
        dottedFillLine('Sinh viên thực hiện:', sinhVien),
        dottedFillLine('MSSV:', maSV),

        leftPara([boldTxt('2.  Bảng điểm tổng hợp')], { before: 100, after: 40 }),
        scoreTable(),

        leftPara([boldTxt('3.  Nhận xét của các thành viên hội đồng:')], { before: 60, after: 20 }),
        ...contentBlock([nhanXetCT, nhanXetTV].filter(Boolean).join('\n'), 1),

        leftPara([boldTxt('4.  Yêu cầu chỉnh sửa')], { before: 20, after: 20 }),
        ...contentBlock(yeuCauChinhSua, 1),

        new Paragraph({ pageBreakBefore: true }),
        signatureBlock(),

        centerPara([boldTxt('Ý KIẾN CỦA CHỦ TỊCH HỘI ĐỒNG SAU KHI SINH VIÊN CHỈNH SỬA')], { before: 320, after: 80 }),
        ...Array.from({ length: 8 }).map(() => chairmanOpinionLine()),
        centerPara([boldTxt('Chủ tịch hội đồng')], { after: 30 }),
        centerPara([txt('(ký, họ và tên)')]),
        new Paragraph({ spacing: { before: 900, after: 0 } }),
        centerPara([boldTxt(chuTichSauChinhSua || chuTichHD || '')]),
      ],
    },
  ],
});

Packer.toBuffer(doc)
  .then((buf) => {
    const outPath = process.argv[3] || '/tmp/bien_ban.docx';
    fs.writeFileSync(outPath, buf);
    console.log(`OK:${outPath}`);
  })
  .catch((err) => {
    console.error(`ERR:${err.message}`);
    process.exit(1);
  });
