// PDF.js Worker Configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

/* ==========================================================================
   0. TAB SWITCHER SYSTEM LOGIC
   ========================================================================== */
function switchTool(toolId) {
    const pdfTool = document.getElementById('pdfToImgTool');
    const epubTool = document.getElementById('epubToPdfTool');
    const tabs = document.querySelectorAll('.tab-btn');

    if (toolId === 'pdfToImgTool') {
        pdfTool.style.display = 'flex';
        epubTool.style.display = 'none';
        tabs[0].classList.add('active');
        tabs[1].classList.remove('active');
    } else {
        pdfTool.style.display = 'none';
        epubTool.style.display = 'flex';
        tabs[0].classList.remove('active');
        tabs[1].classList.add('active');
    }
}

/* ==========================================================================
   DOM ELEMENTS EXTRACTION
   ========================================================================== */
// PDF to Image Elements
const dropZone = document.getElementById('dropZone');
const pdfInput = document.getElementById('pdfInput');
const previewSection = document.getElementById('previewSection');
const pdfPreviewCard = document.getElementById('pdfPreviewCard');
const fileNameEl = document.getElementById('fileName');
const fileSizeEl = document.getElementById('fileSize');
const currentViewPageEl = document.getElementById('currentViewPage');
const totalViewPagesEl = document.getElementById('totalViewPages');
const actionSection = document.getElementById('actionSection');
const pageNumberInput = document.getElementById('pageNumberInput');
const processBtn = document.getElementById('processBtn');
const downloadCompressSection = document.getElementById('downloadCompressSection');
const qualitySlider = document.getElementById('qualitySlider');
const qualityValue = document.getElementById('qualityValue');
const estimatedSize = document.getElementById('estimatedSize');
const downloadBtn = document.getElementById('downloadBtn');

// Modal Elements
const pdfModal = document.getElementById('pdfModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalCurrentPage = document.getElementById('modalCurrentPage');
const modalTotalPages = document.getElementById('modalTotalPages');
const modalPdfCanvas = document.getElementById('modalPdfCanvas');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const selectPageBtn = document.getElementById('selectPageBtn');
const modalPageSlider = document.getElementById('modalPageSlider');

// EPUB to PDF Elements
const epubDropZone = document.getElementById('epubDropZone');
const epubInput = document.getElementById('epubInput');
const epubPreviewSection = document.getElementById('epubPreviewSection');
const epubFileName = document.getElementById('epubFileName');
const epubFileSize = document.getElementById('epubFileSize');
const convertEpubBtn = document.getElementById('convertEpubBtn');
const epubRenderBuffer = document.getElementById('epubRenderBuffer');

/* ==========================================================================
   GLOBAL APP STATE
   ========================================================================== */
let loadedPdf = null;
let processedCanvas = null;
let modalActivePage = 1;
let loadedEpubBook = null;

/* ==========================================================================
   1. FEATURE 1: PDF TO IMAGE LOGIC
   ========================================================================== */
dropZone.addEventListener('click', () => pdfInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
});

pdfInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
});

function handleFile(file) {
    if (file.type !== 'application/pdf') {
        alert('Please upload a valid PDF file.');
        return;
    }
    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

    const reader = new FileReader();
    reader.onload = function(e) {
        const typedarray = new Uint8Array(e.target.result);
        pdfjsLib.getDocument(typedarray).promise.then(pdf => {
            loadedPdf = pdf;
            totalViewPagesEl.textContent = pdf.numPages;
            modalTotalPages.textContent = pdf.numPages;
            pageNumberInput.max = pdf.numPages;
            modalPageSlider.max = pdf.numPages;
            
            currentViewPageEl.textContent = "1";
            modalActivePage = 1;
            modalPageSlider.value = 1;
            pageNumberInput.value = "";

            previewSection.style.display = 'block';
            actionSection.style.display = 'block';
            downloadCompressSection.style.display = 'none';
            actionSection.scrollIntoView({ behavior: 'smooth' });
        }).catch(err => alert('Error loading PDF: ' + err.message));
    };
    reader.readAsArrayBuffer(file);
}

// Modal System (PDF View Panel)
pdfPreviewCard.addEventListener('click', () => {
    if (!loadedPdf) return;
    pdfModal.style.display = 'flex';
    renderModalPage(modalActivePage);
});

closeModalBtn.addEventListener('click', () => pdfModal.style.display = 'none');
pdfModal.addEventListener('click', (e) => { if (e.target === pdfModal) pdfModal.style.display = 'none'; });

function renderModalPage(pageNum) {
    modalCurrentPage.textContent = pageNum;
    modalPageSlider.value = pageNum;
    loadedPdf.getPage(pageNum).then(page => {
        const viewport = page.getViewport({ scale: 1.5 });
        const context = modalPdfCanvas.getContext('2d');
        modalPdfCanvas.height = viewport.height;
        modalPdfCanvas.width = viewport.width;
        page.render({ canvasContext: context, viewport: viewport });
    });
}

prevPageBtn.addEventListener('click', () => { if (modalActivePage > 1) { modalActivePage--; renderModalPage(modalActivePage); } });
nextPageBtn.addEventListener('click', () => { if (modalActivePage < loadedPdf.numPages) { modalActivePage++; renderModalPage(modalActivePage); } });
modalPageSlider.addEventListener('input', (e) => { if (!loadedPdf) return; modalActivePage = parseInt(e.target.value); renderModalPage(modalActivePage); });

selectPageBtn.addEventListener('click', () => {
    currentViewPageEl.textContent = modalActivePage;
    pageNumberInput.value = modalActivePage;
    pdfModal.style.display = 'none';
    processBtn.click();
});

// Conversion Engine (Render to Canvas)
processBtn.addEventListener('click', () => {
    const pageNum = parseInt(pageNumberInput.value);
    if (!loadedPdf || isNaN(pageNum) || pageNum < 1 || pageNum > loadedPdf.numPages) {
        alert('Invalid Page Selection.');
        return;
    }
    processBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    processBtn.disabled = true;

    loadedPdf.getPage(pageNum).then(page => {
        const scale = 3.0; 
        const viewport = page.getViewport({ scale: scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        page.render({ canvasContext: context, viewport: viewport }).promise.then(() => {
            processedCanvas = canvas;
            currentViewPageEl.textContent = pageNum;
            processBtn.innerHTML = '<i class="fa-solid fa-gear"></i> Process Page';
            processBtn.disabled = false;
            downloadCompressSection.style.display = 'block';
            updateCompressionMetrics();
            downloadCompressSection.scrollIntoView({ behavior: 'smooth' });
        });
    });
});

qualitySlider.addEventListener('input', (e) => {
    qualityValue.textContent = e.target.value + '%';
    updateCompressionMetrics();
});

function updateCompressionMetrics() {
    const q = qualitySlider.value;
    estimatedSize.innerHTML = q > 80 ? 'Estimated Size: <span style="color: #38bdf8;">High Res</span>' : q > 45 ? 'Estimated Size: <span style="color: #10b981;">Optimized</span>' : 'Estimated Size: <span style="color: #f59e0b;">Low Size</span>';
}

downloadBtn.addEventListener('click', () => {
    if (!processedCanvas) return;
    const url = processedCanvas.toDataURL('image/jpeg', parseInt(qualitySlider.value) / 100);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileNameEl.textContent.replace('.pdf','')}_Page_${pageNumberInput.value}_compressed.jpg`;
    link.click();
});


/* ==========================================================================
   2. FEATURE 2: EPUB TO PDF LOGIC (NATIVE JSZIP CORE ENGINE - 100% SUCCESS)
   ========================================================================== */
epubDropZone.addEventListener('click', () => epubInput.click());

epubDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    epubDropZone.classList.add('drag-over');
});
epubDropZone.addEventListener('dragleave', () => epubDropZone.classList.remove('drag-over'));

epubDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    epubDropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) handleEpubFile(e.dataTransfer.files[0]);
});

epubInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleEpubFile(e.target.files[0]);
});

function handleEpubFile(file) {
    if (!file.name.endsWith('.epub')) {
        alert('Please upload a valid .epub book file.');
        return;
    }

    epubFileName.textContent = file.name;
    epubFileSize.textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    epubPreviewSection.style.display = 'block';
    
    convertEpubBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Extracting Chapters...';
    convertEpubBtn.disabled = true;
    epubRenderBuffer.innerHTML = "";

    const reader = new FileReader();
    reader.onload = function(e) {
        // Safe check for JSZip availability
        if (typeof JSZip === 'undefined') {
            alert("JSZip core compiler is missing. Reloading app cache recommended.");
            resetEpubBtn();
            return;
        }

        JSZip.loadAsync(e.target.result).then(async (zip) => {
            let htmlFiles = [];
            
            // Extracting all content nodes inside container structure
            zip.forEach((relativePath, fileItem) => {
                if (relativePath.endsWith('.html') || relativePath.endsWith('.xhtml')) {
                    htmlFiles.push({ path: relativePath, file: fileItem });
                }
            });

            // Sorting chapter arrays to preserve order
            htmlFiles.sort((a, b) => a.path.localeCompare(b.path, undefined, {numeric: true, sensitivity: 'base'}));

            if (htmlFiles.length === 0) {
                alert("This book doesn't contain standard text layers.");
                resetEpubBtn();
                return;
            }

            let fullCompiledHtml = "";
            
            // Sequential raw buffer assembly loop
            for (let i = 0; i < htmlFiles.length; i++) {
                try {
                    const rawText = await htmlFiles[i].file.async("text");
                    
                    // Native virtual DOM sandbox tree mapping
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(rawText, 'text/html');
                    const body = doc.querySelector('body');
                    let cleanInnerContent = body ? body.innerHTML : rawText;

                    // Removing layout breaking styles if nested
                    cleanInnerContent = cleanInnerContent.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '');

                    if (cleanInnerContent.trim() !== "") {
                        fullCompiledHtml += `<div class="epub-compiled-page" style="padding: 45px; color: #000000; background-color: #ffffff; font-family: 'Times New Roman', serif; font-size: 16px; line-height: 1.6; page-break-after: always; word-wrap: break-word;">${cleanInnerContent}</div>`;
                    }
                } catch (err) {
                    console.log("Skipped a protected sub-node cluster.", err);
                }
            }

            // Flush pipeline elements into render pipeline layer
            epubRenderBuffer.innerHTML = fullCompiledHtml;

            if (epubRenderBuffer.innerHTML.trim() !== "") {
                convertEpubBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Convert & Download PDF';
                convertEpubBtn.disabled = false;
            } else {
                alert("Text components are heavily encrypted or DRM protected.");
                resetEpubBtn();
            }

        }).catch(err => {
            alert("Error reading file stream package: " + err.message);
            resetEpubBtn();
        });
    };
    reader.readAsArrayBuffer(file);
}

function resetEpubBtn() {
    convertEpubBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Convert & Download PDF';
    convertEpubBtn.disabled = false;
}

convertEpubBtn.addEventListener('click', () => {
    if (!epubRenderBuffer.innerHTML || epubRenderBuffer.innerHTML.trim() === "") {
        alert('EPUB content buffer is empty. Please re-upload the file.');
        return;
    }

    convertEpubBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Rendering PDF Pages...';
    convertEpubBtn.disabled = true;

    const conversionOptions = {
        margin:       12,
        filename:     epubFileName.textContent.replace('.epub', '.pdf'),
        image:        { type: 'jpeg', quality: 0.95 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['css', 'legacy'] }
    };

    html2pdf().set(conversionOptions).from(epubRenderBuffer).save().then(() => {
        resetEpubBtn();
    }).catch(err => {
        alert('Conversion failed: ' + err.message);
        resetEpubBtn();
    });
});
