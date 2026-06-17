// Set up pdf.js worker (needed to read PDF files in the browser)
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Stores the extracted resume text after a PDF is uploaded
let resumeText = '';


// Called whenever a file is selected (via click or drag)
async function handleFile(file) {
  if (!file || file.type !== 'application/pdf') {
    showError('Please upload a PDF file.');
    return;
  }

  const zone   = document.getElementById('uploadZone');
  const status = document.getElementById('uploadStatus');

  zone.classList.remove('success');
  status.textContent = '⏳ Reading PDF...';
  status.classList.remove('hidden');

  try {
    resumeText = await extractTextFromPDF(file);

    if (!resumeText.trim()) {
      showError('Could not read this PDF. Please use a text-based PDF (not a scanned image).');
      status.classList.add('hidden');
      return;
    }

    // Update the zone to show success
    zone.classList.add('success');
    zone.querySelector('.upload-icon').textContent = '✅';
    zone.querySelector('.upload-main').textContent = file.name;
    zone.querySelector('.upload-sub').textContent  = 'Click to change file';
    status.textContent = '✓ Resume loaded successfully';

    hideError();

  } catch (err) {
    showError('Failed to read PDF: ' + err.message);
    status.classList.add('hidden');
  }
}

// Reads all pages of a PDF and returns the full text
async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page     = await pdf.getPage(i);
    const content  = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

// Wire up file input (click to browse)
document.getElementById('resumeFile').addEventListener('change', function(e) {
  handleFile(e.target.files[0]);
});

// Wire up drag and drop
const uploadZone = document.getElementById('uploadZone');

uploadZone.addEventListener('click', function() {
  document.getElementById('resumeFile').click();
});

uploadZone.addEventListener('dragover', function(e) {
  e.preventDefault();
  uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', function() {
  uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', function(e) {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  handleFile(e.dataTransfer.files[0]);
});


function showError(message) {
  const errorEl = document.getElementById('errorMsg');
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function hideError() {
  document.getElementById('errorMsg').classList.add('hidden');
}

function setLoading(isLoading) {
  const btn = document.getElementById('analyseBtn');
  if (isLoading) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Analysing...';
  } else {
    btn.disabled = false;
    btn.textContent = 'Analyse Resume';
  }
}

function displayResults(data) {
  const score = data.score;

  document.getElementById('scoreValue').textContent = score;

  // Colour the circle based on score range
  const circle = document.getElementById('scoreCircle');
  circle.classList.remove('green', 'amber', 'red');

  if (score >= 70) {
    circle.classList.add('green');
    document.getElementById('scoreLabel').textContent = 'Great Match!';
    document.getElementById('scoreDesc').textContent  = 'Your resume is well-aligned. A few small tweaks can push it even higher.';
  } else if (score >= 40) {
    circle.classList.add('amber');
    document.getElementById('scoreLabel').textContent = 'Moderate Match';
    document.getElementById('scoreDesc').textContent  = 'Your resume partially matches. Adding the missing keywords will improve your chances.';
  } else {
    circle.classList.add('red');
    document.getElementById('scoreLabel').textContent = 'Low Match';
    document.getElementById('scoreDesc').textContent  = 'Your resume needs updates to pass ATS for this role. Focus on the missing keywords below.';
  }

  const matchedList = document.getElementById('matchedList');
  matchedList.innerHTML = '';
  data.matched_keywords.forEach(function(keyword) {
    const li = document.createElement('li');
    li.textContent = keyword;
    matchedList.appendChild(li);
  });

  const missingList = document.getElementById('missingList');
  missingList.innerHTML = '';
  data.missing_keywords.forEach(function(keyword) {
    const li = document.createElement('li');
    li.textContent = keyword;
    missingList.appendChild(li);
  });

  const suggestionsList = document.getElementById('suggestionsList');
  suggestionsList.innerHTML = '';
  data.suggestions.forEach(function(suggestion) {
    const li = document.createElement('li');
    li.textContent = suggestion;
    suggestionsList.appendChild(li);
  });

  document.getElementById('summaryText').textContent = data.summary;

  // Show results and scroll to them
  document.getElementById('results').classList.remove('hidden');
  document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
}


// Main function — runs when the Analyse button is clicked
async function analyseResume() {
  const jd = document.getElementById('jd').value.trim();

  hideError();

  if (!resumeText) { showError('Please upload your resume PDF first.'); return; }
  if (!jd)         { showError('Please paste the job description.'); return; }

  setLoading(true);
  document.getElementById('results').classList.add('hidden');

  try {
    // Send resume text + JD to our backend — backend adds the API key and calls Gemini
    const response = await fetch('/api/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume: resumeText, jd })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Something went wrong.');
    }

    displayResults(data);

  } catch (error) {
    showError('Error: ' + error.message);

  } finally {
    setLoading(false);
  }
}