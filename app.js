const imageInput = document.querySelector('#imageInput');
const dropzone = document.querySelector('#dropzone');
const fileInfo = document.querySelector('#fileInfo');
const clearImageButton = document.querySelector('#clearImageButton');
const rowsInput = document.querySelector('#rows');
const colsInput = document.querySelector('#cols');
const totalParts = document.querySelector('#totalParts');
const tileEstimate = document.querySelector('#tileEstimate');
const orientation = document.querySelector('#orientation');
const orientationInfo = document.querySelector('#orientationInfo');
const previewStage = document.querySelector('#previewStage');
const previewPlaceholder = document.querySelector('#previewPlaceholder');
const previewPages = document.querySelector('#previewPages');
const downloadButton = document.querySelector('#downloadButton');
const pdfButton = document.querySelector('#pdfButton');
const printButton = document.querySelector('#printButton');
const toast = document.querySelector('#toast');

let sourceImage = null;
let imageUrl = null;
let toastTimer;
let fileLoadToken = 0;

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40_000_000;
const allowedImageFormats = {
  jpeg: {
    mimeTypes: ['image/jpeg', 'image/pjpeg'],
    extensions: ['jpg', 'jpeg', 'jfif'],
  },
  png: {
    mimeTypes: ['image/png'],
    extensions: ['png'],
  },
  webp: {
    mimeTypes: ['image/webp'],
    extensions: ['webp'],
  },
  gif: {
    mimeTypes: ['image/gif'],
    extensions: ['gif'],
  },
};

function getDivisionValue(input) {
  const value = Number.parseInt(input.value, 10);
  return Number.isFinite(value) ? Math.min(12, Math.max(1, value)) : 1;
}

function formatPixels(value) {
  return new Intl.NumberFormat('pt-BR').format(value) + ' px';
}

function getPaperOrientation() {
  if (orientation.value !== 'auto') return orientation.value;
  if (!sourceImage) return 'portrait';
  const rows = getDivisionValue(rowsInput);
  const cols = getDivisionValue(colsInput);
  const tileWidth = sourceImage.naturalWidth / cols;
  const tileHeight = sourceImage.naturalHeight / rows;
  return tileWidth > tileHeight ? 'landscape' : 'portrait';
}

function getPaperSize() {
  return getPaperOrientation() === 'landscape'
    ? { width: 841.89, height: 595.28, label: 'paisagem' }
    : { width: 595.28, height: 841.89, label: 'retrato' };
}

function updateInterface() {
  const rows = getDivisionValue(rowsInput);
  const cols = getDivisionValue(colsInput);
  rowsInput.value = rows;
  colsInput.value = cols;

  const parts = rows * cols;
  totalParts.textContent = `${parts} ${parts === 1 ? 'parte' : 'partes'}`;

  if (sourceImage) {
    const width = Math.ceil(sourceImage.naturalWidth / cols);
    const height = Math.ceil(sourceImage.naturalHeight / rows);
    tileEstimate.textContent = `Cada parte terá até ${formatPixels(width)} × ${formatPixels(height)}.`;
    const paper = getPaperSize();
    orientationInfo.textContent = `Folhas A4 em ${paper.label}. A prévia abaixo acompanha esta escolha.`;
    renderPagePreview(rows, cols, paper);
  } else {
    tileEstimate.textContent = 'Envie uma imagem para ver o tamanho de cada parte.';
    orientationInfo.textContent = 'A prévia mostrará a orientação escolhida.';
  }
}

function renderPagePreview(rows, cols, paper) {
  const gap = 10;
  const availableWidth = Math.max(180, previewStage.clientWidth - 50);
  const maxPreviewWidth = Math.min(700, availableWidth);
  const maxPreviewHeight = 460;
  const paperRatio = paper.height / paper.width;
  const widthByColumns = (maxPreviewWidth - gap * (cols - 1)) / cols;
  const widthByRows = (maxPreviewHeight - gap * (rows - 1)) / (rows * paperRatio);
  const pageWidth = Math.max(34, Math.min(widthByColumns, widthByRows));
  const pageHeight = pageWidth * paperRatio;

  previewPages.style.gridTemplateColumns = `repeat(${cols}, ${pageWidth}px)`;
  previewPages.style.width = `${pageWidth * cols + gap * (cols - 1)}px`;
  previewPages.replaceChildren();

  let pageNumber = 1;
  for (let row = 0; row < rows; row += 1) {
    const y = getTileBounds(row, rows, sourceImage.naturalHeight);
    for (let col = 0; col < cols; col += 1) {
      const x = getTileBounds(col, cols, sourceImage.naturalWidth);
      const page = document.createElement('div');
      page.className = 'preview-page';
      page.dataset.page = pageNumber;
      page.style.width = `${pageWidth}px`;
      page.style.height = `${pageHeight}px`;

      const margin = 18;
      const scale = Math.min((paper.width - margin * 2) / x.size, (paper.height - margin * 2) / y.size);
      const art = document.createElement('div');
      art.className = 'preview-art';
      art.style.width = `${(x.size * scale * 100) / paper.width}%`;
      art.style.height = `${(y.size * scale * 100) / paper.height}%`;
      art.style.backgroundImage = `url("${imageUrl}")`;
      art.style.backgroundSize = `${(sourceImage.naturalWidth * 100) / x.size}% ${(sourceImage.naturalHeight * 100) / y.size}%`;
      const xPosition = sourceImage.naturalWidth === x.size ? 0 : (x.start * 100) / (sourceImage.naturalWidth - x.size);
      const yPosition = sourceImage.naturalHeight === y.size ? 0 : (y.start * 100) / (sourceImage.naturalHeight - y.size);
      art.style.backgroundPosition = `${xPosition}% ${yPosition}%`;
      page.append(art);
      previewPages.append(page);
      pageNumber += 1;
    }
  }
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('visible');
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 3800);
}

function bytesMatch(bytes, signature, offset = 0) {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function detectImageFormat(bytes) {
  if (bytesMatch(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (bytesMatch(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (bytesMatch(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || bytesMatch(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return 'gif';
  if (bytesMatch(bytes, [0x52, 0x49, 0x46, 0x46]) && bytesMatch(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp';
  return null;
}

async function validateImageFile(file) {
  if (!file || typeof file.slice !== 'function' || !file.size) {
    return { valid: false, message: 'Escolha um arquivo de imagem válido.' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, message: 'A imagem deve ter no máximo 25 MB.' };
  }

  try {
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const format = detectImageFormat(header);
    if (!format) {
      return { valid: false, message: 'Formato não permitido. Envie JPG, PNG, WEBP ou GIF.' };
    }

    const config = allowedImageFormats[format];
    const extension = String(file.name || '').split('.').pop().toLowerCase();
    if (!config.extensions.includes(extension)) {
      return { valid: false, message: 'A extensão do arquivo não corresponde a uma imagem permitida.' };
    }
    if (file.type && !config.mimeTypes.includes(file.type.toLowerCase())) {
      return { valid: false, message: 'O tipo do arquivo não corresponde ao formato da imagem.' };
    }
    return { valid: true };
  } catch (error) {
    console.error(error);
    return { valid: false, message: 'Não foi possível verificar esse arquivo. Escolha outra imagem.' };
  }
}

async function loadFile(file) {
  if (!file) return;
  const loadToken = ++fileLoadToken;
  const validation = await validateImageFile(file);
  if (loadToken !== fileLoadToken) return;

  if (!validation.valid) {
    imageInput.value = '';
    showToast(validation.message);
    return;
  }

  const candidateUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    if (loadToken !== fileLoadToken) {
      URL.revokeObjectURL(candidateUrl);
      return;
    }
    const pixelCount = image.naturalWidth * image.naturalHeight;
    if (!image.naturalWidth || !image.naturalHeight || pixelCount > MAX_IMAGE_PIXELS) {
      URL.revokeObjectURL(candidateUrl);
      imageInput.value = '';
      showToast('A resolução da imagem é muito alta. Use uma imagem de até 40 megapixels.');
      return;
    }

    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = candidateUrl;
    sourceImage = image;
    previewPlaceholder.hidden = true;
    previewPages.hidden = false;
    previewStage.classList.remove('empty');
    fileInfo.textContent = `${file.name} · ${formatPixels(image.naturalWidth)} × ${formatPixels(image.naturalHeight)}`;
    setDownloadButtonsDisabled(false);
    updateInterface();
  };
  image.onerror = () => {
    URL.revokeObjectURL(candidateUrl);
    if (loadToken !== fileLoadToken) return;
    imageInput.value = '';
    showToast('Não foi possível abrir essa imagem. Escolha um arquivo válido.');
  };
  image.src = candidateUrl;
}

imageInput.addEventListener('change', () => loadFile(imageInput.files[0]));

clearImageButton.addEventListener('click', () => {
  fileLoadToken += 1;
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = null;
  sourceImage = null;
  imageInput.value = '';
  fileInfo.textContent = 'Nenhum arquivo selecionado';
  previewPages.replaceChildren();
  previewPages.hidden = true;
  previewPlaceholder.hidden = false;
  previewStage.classList.add('empty');
  clearImageButton.disabled = true;
  setDownloadButtonsDisabled(true);
  updateInterface();
  showToast('Imagem removida. Você já pode escolher outra foto.');
});

for (const input of [rowsInput, colsInput]) {
  input.addEventListener('input', updateInterface);
  input.addEventListener('change', updateInterface);
}

orientation.addEventListener('change', updateInterface);
window.addEventListener('resize', () => {
  if (sourceImage) updateInterface();
});

document.querySelectorAll('.stepper-button').forEach((button) => {
  button.addEventListener('click', () => {
    const input = document.querySelector(`#${button.dataset.target}`);
    input.value = getDivisionValue(input) + Number(button.dataset.change);
    updateInterface();
  });
});

['dragenter', 'dragover'].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove('dragover');
  });
});

dropzone.addEventListener('drop', (event) => {
  const [file] = event.dataTransfer.files;
  if (!file) return;
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  imageInput.files = dataTransfer.files;
  loadFile(file);
});

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Falha ao gerar uma parte da imagem.'));
    }, 'image/png');
  });
}

function canvasToJpegBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Falha ao gerar uma página do PDF.'));
    }, 'image/jpeg', 0.94);
  });
}

function getTileBounds(index, count, fullSize) {
  const start = Math.floor((index * fullSize) / count);
  const end = Math.floor(((index + 1) * fullSize) / count);
  return { start, size: end - start };
}

async function createTiles() {
  const rows = getDivisionValue(rowsInput);
  const cols = getDivisionValue(colsInput);
  const tiles = [];

  for (let row = 0; row < rows; row += 1) {
    const y = getTileBounds(row, rows, sourceImage.naturalHeight);
    for (let col = 0; col < cols; col += 1) {
      const x = getTileBounds(col, cols, sourceImage.naturalWidth);
      const canvas = document.createElement('canvas');
      canvas.width = x.size;
      canvas.height = y.size;
      const context = canvas.getContext('2d');
      context.drawImage(sourceImage, x.start, y.start, x.size, y.size, 0, 0, x.size, y.size);
      const blob = await canvasToBlob(canvas);
      const name = `parte-linha-${String(row + 1).padStart(2, '0')}-coluna-${String(col + 1).padStart(2, '0')}.png`;
      tiles.push({ name, data: new Uint8Array(await blob.arrayBuffer()) });
    }
  }
  return tiles;
}

function createTileCanvas(row, col, fillBackground = false) {
  const rows = getDivisionValue(rowsInput);
  const cols = getDivisionValue(colsInput);
  const y = getTileBounds(row, rows, sourceImage.naturalHeight);
  const x = getTileBounds(col, cols, sourceImage.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = x.size;
  canvas.height = y.size;
  const context = canvas.getContext('2d');
  if (fillBackground) {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, x.size, y.size);
  }
  context.drawImage(sourceImage, x.start, y.start, x.size, y.size, 0, 0, x.size, y.size);
  return canvas;
}

async function createPdfPages() {
  const rows = getDivisionValue(rowsInput);
  const cols = getDivisionValue(colsInput);
  const pages = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const canvas = createTileCanvas(row, col, true);
      const jpeg = await canvasToJpegBlob(canvas);
      pages.push({
        width: canvas.width,
        height: canvas.height,
        data: new Uint8Array(await jpeg.arrayBuffer()),
      });
    }
  }
  return pages;
}

// ZIP simples, sem compressão, para manter a ferramenta totalmente offline.
function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    table[index] = value >>> 0;
  }
  return table;
}

const crcTable = makeCrcTable();

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(target, offset, value) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(target, offset, value) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function zipFiles(files) {
  const encoder = new TextEncoder();
  const entries = files.map((file) => ({ ...file, nameBytes: encoder.encode(file.name), crc: crc32(file.data) }));
  const localSize = entries.reduce((size, file) => size + 30 + file.nameBytes.length + file.data.length, 0);
  const centralSize = entries.reduce((size, file) => size + 46 + file.nameBytes.length, 0);
  const output = new Uint8Array(localSize + centralSize + 22);
  let offset = 0;
  let localOffset = 0;

  for (const file of entries) {
    writeUint32(output, offset, 0x04034b50);
    writeUint16(output, offset + 4, 20);
    writeUint16(output, offset + 6, 0x0800);
    writeUint16(output, offset + 8, 0);
    writeUint16(output, offset + 10, 0);
    writeUint16(output, offset + 12, 0);
    writeUint32(output, offset + 14, file.crc);
    writeUint32(output, offset + 18, file.data.length);
    writeUint32(output, offset + 22, file.data.length);
    writeUint16(output, offset + 26, file.nameBytes.length);
    writeUint16(output, offset + 28, 0);
    output.set(file.nameBytes, offset + 30);
    output.set(file.data, offset + 30 + file.nameBytes.length);
    file.localOffset = localOffset;
    const entrySize = 30 + file.nameBytes.length + file.data.length;
    offset += entrySize;
    localOffset += entrySize;
  }

  const centralOffset = offset;
  for (const file of entries) {
    writeUint32(output, offset, 0x02014b50);
    writeUint16(output, offset + 4, 20);
    writeUint16(output, offset + 6, 20);
    writeUint16(output, offset + 8, 0x0800);
    writeUint16(output, offset + 10, 0);
    writeUint16(output, offset + 12, 0);
    writeUint16(output, offset + 14, 0);
    writeUint32(output, offset + 16, file.crc);
    writeUint32(output, offset + 20, file.data.length);
    writeUint32(output, offset + 24, file.data.length);
    writeUint16(output, offset + 28, file.nameBytes.length);
    writeUint16(output, offset + 30, 0);
    writeUint16(output, offset + 32, 0);
    writeUint16(output, offset + 34, 0);
    writeUint16(output, offset + 36, 0);
    writeUint32(output, offset + 38, 0);
    writeUint32(output, offset + 42, file.localOffset);
    output.set(file.nameBytes, offset + 46);
    offset += 46 + file.nameBytes.length;
  }

  writeUint32(output, offset, 0x06054b50);
  writeUint16(output, offset + 4, 0);
  writeUint16(output, offset + 6, 0);
  writeUint16(output, offset + 8, entries.length);
  writeUint16(output, offset + 10, entries.length);
  writeUint32(output, offset + 12, centralSize);
  writeUint32(output, offset + 16, centralOffset);
  writeUint16(output, offset + 20, 0);
  return output;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function joinBytes(chunks) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const joined = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  return joined;
}

const pdfEncoder = new TextEncoder();

function pdfText(value) {
  return pdfEncoder.encode(value);
}

function pdfStream(dictionary, data) {
  return joinBytes([pdfText(`${dictionary}\nstream\n`), data, pdfText('\nendstream')]);
}

function formatPdfNumber(value) {
  return Number(value.toFixed(2)).toString();
}

function createPdf(pages) {
  const objects = [];
  const pageNumbers = pages.map((_, index) => 3 + index * 3);
  const imageNumbers = pages.map((_, index) => 4 + index * 3);
  const contentNumbers = pages.map((_, index) => 5 + index * 3);
  const infoNumber = 3 + pages.length * 3;

  objects[0] = pdfText('<< /Type /Catalog /Pages 2 0 R >>');
  objects[1] = pdfText(`<< /Type /Pages /Kids [${pageNumbers.map((number) => `${number} 0 R`).join(' ')}] /Count ${pages.length} >>`);

  const paper = getPaperSize();
  pages.forEach((page, index) => {
    const pageWidth = paper.width;
    const pageHeight = paper.height;
    const margin = 18;
    const scale = Math.min((pageWidth - margin * 2) / page.width, (pageHeight - margin * 2) / page.height);
    const drawWidth = page.width * scale;
    const drawHeight = page.height * scale;
    const x = (pageWidth - drawWidth) / 2;
    const y = (pageHeight - drawHeight) / 2;
    const imageName = `/Imagem${index + 1}`;
    const content = pdfText(
      `q\n${formatPdfNumber(drawWidth)} 0 0 ${formatPdfNumber(drawHeight)} ${formatPdfNumber(x)} ${formatPdfNumber(y)} cm\n${imageName} Do\nQ`,
    );

    objects[pageNumbers[index] - 1] = pdfText(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /ProcSet [/PDF /ImageC] /XObject << ${imageName} ${imageNumbers[index]} 0 R >> >> /Contents ${contentNumbers[index]} 0 R >>`,
    );
    objects[imageNumbers[index] - 1] = pdfStream(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.data.length} >>`,
      page.data,
    );
    objects[contentNumbers[index] - 1] = pdfStream(`<< /Length ${content.length} >>`, content);
  });

  objects[infoNumber - 1] = pdfText('<< /Title (Foto em Partes) /Producer (Foto em Partes) >>');

  const header = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 255, 255, 255, 255, 10]);
  const chunks = [header];
  const offsets = [0];
  let position = header.length;

  objects.forEach((object, index) => {
    offsets.push(position);
    const wrapped = joinBytes([pdfText(`${index + 1} 0 obj\n`), object, pdfText('\nendobj\n')]);
    chunks.push(wrapped);
    position += wrapped.length;
  });

  const crossReferenceOffset = position;
  let crossReference = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    crossReference += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  crossReference += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoNumber} 0 R >>\nstartxref\n${crossReferenceOffset}\n%%EOF`;
  chunks.push(pdfText(crossReference));
  return joinBytes(chunks);
}

function setDownloadButtonsDisabled(disabled) {
  downloadButton.disabled = disabled;
  pdfButton.disabled = disabled;
  printButton.disabled = disabled;
  clearImageButton.disabled = disabled ? true : !sourceImage;
}

downloadButton.addEventListener('click', async () => {
  if (!sourceImage) return;
  const originalLabel = downloadButton.innerHTML;
  setDownloadButtonsDisabled(true);
  downloadButton.textContent = 'Gerando partes...';
  try {
    const tiles = await createTiles();
    const zip = zipFiles(tiles);
    downloadBlob(new Blob([zip], { type: 'application/zip' }), 'foto-em-partes.zip');
    showToast('ZIP criado! As imagens estão numeradas por linha e coluna.');
  } catch (error) {
    console.error(error);
    showToast('Não foi possível criar o ZIP. Tente usar outra imagem.');
  } finally {
    downloadButton.innerHTML = originalLabel;
    setDownloadButtonsDisabled(false);
  }
});

pdfButton.addEventListener('click', async () => {
  if (!sourceImage) return;
  const originalLabel = pdfButton.innerHTML;
  setDownloadButtonsDisabled(true);
  pdfButton.textContent = 'Gerando PDF...';
  try {
    const pages = await createPdfPages();
    const pdf = createPdf(pages);
    downloadBlob(new Blob([pdf], { type: 'application/pdf' }), 'foto-em-partes.pdf');
    showToast('PDF criado! Cada parte ocupa uma folha A4.');
  } catch (error) {
    console.error(error);
    showToast('Não foi possível criar o PDF. Tente usar outra imagem.');
  } finally {
    pdfButton.innerHTML = originalLabel;
    setDownloadButtonsDisabled(false);
  }
});

function createPrintableImages() {
  const rows = getDivisionValue(rowsInput);
  const cols = getDivisionValue(colsInput);
  const images = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const canvas = createTileCanvas(row, col, true);
      images.push(canvas.toDataURL('image/jpeg', 0.94));
    }
  }
  return images;
}

function createPrintDocument(images, paper) {
  const orientationStylesheet = paper.label === 'paisagem' ? 'print-landscape.css' : 'print-portrait.css';
  const baseStylesheetUrl = new URL('print.css', window.location.href).href;
  const orientationStylesheetUrl = new URL(orientationStylesheet, window.location.href).href;
  const printScriptUrl = new URL('print.js', window.location.href).href;
  const sheets = images
    .map((image, index) => `<section class="sheet"><img src="${image}" alt="Parte ${index + 1}" /></section>`)
    .join('');

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <title>Foto em partes - impressão</title>
    <link rel="stylesheet" href="${baseStylesheetUrl}" />
    <link rel="stylesheet" href="${orientationStylesheetUrl}" />
    <script defer src="${printScriptUrl}"></script>
  </head>
  <body>${sheets}
    <button class="print-trigger" type="button" data-print-trigger>Imprimir agora</button>
  </body>
</html>`;
}

function loadPrintPage(printWindow, html) {
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

printButton.addEventListener('click', () => {
  if (!sourceImage) return;
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showToast('O navegador bloqueou a janela de impressão. Permita pop-ups e tente novamente.');
    return;
  }

  const originalLabel = printButton.innerHTML;
  setDownloadButtonsDisabled(true);
  printButton.textContent = 'Preparando...';
  try {
    const images = createPrintableImages();
    loadPrintPage(printWindow, createPrintDocument(images, getPaperSize()));
    showToast('A caixa de impressão será aberta em uma nova janela.');
  } catch (error) {
    console.error(error);
    printWindow.close();
    showToast('Não foi possível preparar a impressão. Tente usar outra imagem.');
  } finally {
    printButton.innerHTML = originalLabel;
    setDownloadButtonsDisabled(false);
  }
});

updateInterface();
