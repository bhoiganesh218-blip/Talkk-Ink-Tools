// PDF.js Worker Configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

/* ==========================================================================
   0. TAB SWITCHER SYSTEM LOGIC
   ========================================================================== */
function switchTool(toolId) {
    // Dono tool wrappers ko select karein
    const pdfTool = document.getElementById('pdfToImgTool');
    const epubTool = document.getElementById('epubToPdfTool');
    const tabs = document.querySelectorAll('.tab-btn');

    // Content toggle karein
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

// NEW: EPUB to PDF Elements
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
let loadedEpubBook = null; // Stores parsed EPUB object

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
        const scale = 3.0; // Ultra high-res factor
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
   2. NEW FEATURE: FEATURE 2: EPUB TO PDF LOGIC
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

// EPUB File Processing System
function handleEpubFile(file) {
    // Simple verification check (.epub extension or mime-type)
    if (!file.name.endsWith('.epub')) {
        alert('Please upload a valid .epub book file.');
        return;
    }

    epubFileName.textContent = file.name;
    epubFileSize.textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    epubPreviewSection.style.display = 'block';
    
    // Clear old hidden render data buffer if any
    epubRenderBuffer.innerHTML = "";

    // Read file data into ArrayBuffer array using FileReader API
    const reader = new FileReader();
    reader.onload = function(e) {
        // Initialize Epub.js engine instance 
        loadedEpubBook = ePub(e.target.result);
        
        // Pure text string nodes extraction logic for compiling e-book elements
        loadedEpubBook.ready.then(() => {
            // Get all sections/chapters mapping references
            const spine = loadedEpubBook.spine;
            
            // Loop through chapters to extract body content structures asynchronously
            const promises = spine.spineItems.map(item => {
                return item.load(loadedEpubBook.load.bind(loadedEpubBook)).then(html => {
                    const body = html.querySelector('body');
                    return body ? body.innerHTML : '';
                });
            });

            Promise.all(promises).then(chaptersHtmlArray => {
                // Compile clean html contents sequentially into wrapper buffer container
                chaptersHtmlArray.forEach((htmlContent, index) => {
                    const chapterContainer = document.createElement('div');
                    chapterContainer.className = 'epub-compiled-page';
                    // Inline aesthetic design rules parsing for beautiful compiled text styling
                    chapterContainer.style.padding = '40px';
                    chapterContainer.style.color = '#000000'; // Pure dark black text representation for standard print layouts
                    chapterContainer.style.backgroundColor = '#ffffff';
                    chapterContainer.style.fontFamily = 'serif';
                    chapterContainer.style.lineHeight = '1.6';
                    
                    chapterContainer.innerHTML = htmlContent;
                    epubRenderBuffer.appendChild(chapterContainer);
                });
            });
        });
    };
    reader.readAsArrayBuffer(file);
}

// Convert HTML Content Buffer Array into Premium Print Ready PDF Document Structure
convertEpubBtn.addEventListener('click', () => {
    if (!epubRenderBuffer.innerHTML) {
        alert('EPUB content buffer is empty or parsing. Please wait a few seconds.');
        return;
    }

    convertEpubBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Converting Book...';
    convertEpubBtn.disabled = true;

    // Custom configuration parameters tuning for html2pdf renderer core
    const conversionOptions = {
        margin:       15,
        filename:     epubFileName.textContent.replace('.epub', '.pdf'),
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] } // Prevents cut-off texts midway inside structural layouts
    };

    // Trigger instant download task sequence smoothly
    html2pdf().set(conversionOptions).from(epubRenderBuffer).save().then(() => {
        convertEpubBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Convert & Download PDF';
        convertEpubBtn.disabled = false;
    }).catch(err => {
        alert('Conversion failed: ' + err.message);
        convertEpubBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Convert & Download PDF';
        convertEpubBtn.disabled = false;
    });
});
