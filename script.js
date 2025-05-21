// DOM Elements
const takePhotoButton = document.getElementById('takePhotoButton');
const cameraFeed = document.getElementById('cameraFeed');
const snapshotCanvas = document.getElementById('snapshotCanvas');
const resultDiv = document.getElementById('result');

// Global variables
let currentWord = null;
let currentImage = null;
let stream = null;

// ------- Camera Functions --------
async function startCamera() {
    try {
        // Stop any existing stream
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        
        // Request camera access
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: "environment" // Prefer back camera
            } 
        });
        
        // Set video source and enable button
        cameraFeed.srcObject = stream;
        takePhotoButton.disabled = false;
        
        // Reset UI
        resultDiv.style.display = 'none';
    } catch (err) {
        console.error("Error accessing camera:", err);
        document.getElementById('cameraContainer').innerHTML = `
            <div style="color: #f44336; text-align: center; padding: 40px;">
                <div style="font-size: 48px; margin-bottom: 16px;">📷</div>
                <h3>Cannot access camera</h3>
                <p>Please ensure camera permissions are granted for this site.</p>
            </div>
        `;
        takePhotoButton.disabled = true;
    }
}

// Take photo and immediately analyze the image
async function takeAndAnalyzePhoto() {
    // First take the photo
    if (!stream || !stream.active) {
        alert("Camera is not active. Please refresh the page.");
        return;
    }
    
    // Set canvas dimensions to match video dimensions
    const context = snapshotCanvas.getContext('2d');
    snapshotCanvas.width = cameraFeed.videoWidth;
    snapshotCanvas.height = cameraFeed.videoHeight;
    
    // Draw the current video frame onto the canvas
    context.save();
    if (cameraFeed.style.transform === 'scaleX(-1)') { // If mirrored
        context.translate(snapshotCanvas.width, 0);
        context.scale(-1, 1);
    }
    context.drawImage(cameraFeed, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
    context.restore();
    
    // Get image as base64 data URL
    currentImage = snapshotCanvas.toDataURL('image/jpeg');
    
    // Immediately analyze the photo without requiring a second button click
    await analyzeImage();
}

// Analyze the captured image
async function analyzeImage() {
    if (!currentImage) {
        alert('Please take a photo first! 📷');
        return;
    }
    
    // Disable button and show loading state
    takePhotoButton.disabled = true;
    takePhotoButton.innerHTML = '<span class="icon">⏳</span> Processing...';
    resultDiv.style.display = 'block';
    resultDiv.className = 'loading';
    resultDiv.innerHTML = '<div style="padding: 20px;">🔍 Identifying the object...</div>';
    
    try {
        // Send API request to identify the object
        const response = await fetch('https://aihubmix.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer sk-jRGuOoxjlz4cyO5aA6Fe05B8E58c4b17B9DaA0Fb1776F0E8',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Look at this image and tell me the main object in English. Please respond with just the English word (or phrase if necessary) and a very brief description. Format: 'WORD: brief description'. For example: 'CUP: A container for drinking beverages' or 'SMARTPHONE: A mobile device for communication and apps'"
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: currentImage
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 100,
                temperature: 0.1
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
            console.error("API Error Response:", errorData);
            throw new Error(`HTTP error! status: ${response.status} - ${errorData.detail || response.statusText}`);
        }
        
        const data = await response.json();
        
        // Format and display the result
        resultDiv.className = 'success';
        if (data.choices && data.choices[0] && data.choices[0].message) {
            const content = data.choices[0].message.content;
            const match = content.match(/^([^:]+):\s*(.+)$/);
            
            if (match) {
                const word = match[1].trim();
                const description = match[2].trim();
                currentWord = { word, description };
                
                resultDiv.innerHTML = `
                    <div class="english-word">${word}</div>
                    <div class="brief-description">${description}</div>
                    <div class="action-buttons">
                        <button id="speakButton" class="speak-button" onclick="speakWord('${word}')">
                            <span class="icon">🔊</span> Speak
                        </button>
                        <button id="favoriteButton" class="favorite-button" onclick="addToFavorites()">
                            <span class="icon">⭐</span> Add to Favorites
                        </button>
                    </div>
                `;
            } else {
                currentWord = { word: content, description: '' };
                resultDiv.innerHTML = `
                    <div class="english-word">${content}</div>
                    <div class="action-buttons">
                        <button id="favoriteButton" class="favorite-button" onclick="addToFavorites()">
                            <span class="icon">⭐</span> Add to Favorites
                        </button>
                    </div>
                `;
            }
        } else {
            resultDiv.className = 'error';
            resultDiv.innerHTML = '<div>😕 Could not identify the object. Please try again.</div>';
        }
    } catch (error) {
        console.error('Error:', error);
        resultDiv.className = 'error';
        resultDiv.innerHTML = `<div>❌ Error: ${error.message}<br>Please check your connection and try again.</div>`;
    } finally {
        takePhotoButton.disabled = false;
        takePhotoButton.innerHTML = '<span class="icon">📸</span> Take Photo';
    }
}

// ------- Favorites Functions --------
function loadFavorites() {
    const favorites = localStorage.getItem('wordFavorites');
    return favorites ? JSON.parse(favorites) : [];
}

function saveFavorites(favorites) {
    localStorage.setItem('wordFavorites', JSON.stringify(favorites));
    updateStats();
}

function addToFavorites() {
    if (!currentWord || !currentImage) return;
    
    const favorites = loadFavorites();
    const newFavorite = {
        word: currentWord.word,
        description: currentWord.description,
        image: currentImage,
        date: new Date().toISOString()
    };
    
    favorites.unshift(newFavorite);
    saveFavorites(favorites);
    
    const favoriteBtn = document.getElementById('favoriteButton');
    if (favoriteBtn) {
        favoriteBtn.innerHTML = '<span class="icon">✅</span> Saved!';
        favoriteBtn.classList.add('favorited');
        setTimeout(() => {
            if (favoriteBtn.classList.contains('favorited')) {
                favoriteBtn.innerHTML = '<span class="icon">⭐</span> Added to Favorites';
            }
        }, 1500);
    }
}

function deleteFavorite(index) {
    if (confirm('Are you sure you want to delete this word?')) {
        const favorites = loadFavorites();
        favorites.splice(index, 1);
        saveFavorites(favorites);
        displayFavorites();
    }
}

function clearAllFavorites() {
    if (confirm('Are you sure you want to clear all saved words?')) {
        localStorage.removeItem('wordFavorites');
        updateStats();
        displayFavorites();
    }
}

function exportFavorites() {
    const favorites = loadFavorites();
    if (favorites.length === 0) {
        alert('No words to export!');
        return;
    }
    
    const text = favorites.map(fav => 
        `${fav.word}: ${fav.description} (${new Date(fav.date).toLocaleDateString()})`
    ).join('\n');
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vocabulary_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

// ------- UI Functions --------
function switchTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`button[onclick="switchTab('${tab}')"]`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`${tab}-tab`).classList.add('active');
    
    // Handle tab-specific actions
    if (tab === 'camera') {
        startCamera(); // Start camera when switching to camera tab
    } else if (tab === 'favorites') {
        if (stream) { // Stop camera if switching away
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        displayFavorites();
    }
}

function updateStats() {
    const favorites = loadFavorites();
    const today = new Date().toDateString();
    const todayFavorites = favorites.filter(fav => 
        new Date(fav.date).toDateString() === today
    );
    
    document.getElementById('totalWords').textContent = favorites.length;
    document.getElementById('todayWords').textContent = todayFavorites.length;
}

function displayFavorites() {
    const favorites = loadFavorites();
    const container = document.getElementById('favoritesList');
    
    if (favorites.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">📚</div>
                <h3>No words saved yet</h3>
                <p>Start taking photos to build your vocabulary!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = favorites.map((favorite, index) => `
        <div class="favorite-item">
            <img src="${favorite.image}" alt="${favorite.word}" class="favorite-image">
            <div class="favorite-content">
                <div class="favorite-word">${favorite.word}</div>
                <div class="favorite-description">${favorite.description}</div>
                <div class="favorite-date">${new Date(favorite.date).toLocaleDateString()}</div>
            </div>
            <div class="favorite-actions">
                <button class="danger-button" onclick="deleteFavorite(${index})">
                    <span class="icon">🗑️</span>
                </button>
            </div>
        </div>
    `).join('');
}

// ------- Event Listeners --------
takePhotoButton.addEventListener('click', takeAndAnalyzePhoto);

// ------- Initialize --------
document.addEventListener('DOMContentLoaded', function() {
    updateStats();
    if (document.getElementById('camera-tab').classList.contains('active')) {
        startCamera();
    }
});

// Add this new function for text-to-speech
async function speakWord(word) {
    try {
        const speakButton = document.getElementById('speakButton');
        speakButton.disabled = true;
        speakButton.innerHTML = '<span class="icon">⏳</span> Speaking...';

        const response = await fetch('https://aihubmix.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer sk-jRGuOoxjlz4cyO5aA6Fe05B8E58c4b17B9DaA0Fb1776F0E8',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: "gpt-4o-mini-tts",
                voice: "coral",
                input: word,
                instructions: "Speak clearly and naturally."
            })
        });

        if (!response.ok) {
            throw new Error('Failed to generate speech');
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
            speakButton.disabled = false;
            speakButton.innerHTML = '<span class="icon">🔊</span> Speak';
        };

        audio.play();
    } catch (error) {
        console.error('Error playing speech:', error);
        const speakButton = document.getElementById('speakButton');
        speakButton.disabled = false;
        speakButton.innerHTML = '<span class="icon">🔊</span> Speak';
        alert('Failed to play speech. Please try again.');
    }
}