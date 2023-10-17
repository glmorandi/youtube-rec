// ==UserScript==
// @name         youtube-rec
// @version      0.1
// @description  Removes videos based on a Bayesian recommendation system
// @author       glmorandi
// @match        https://www.youtube.com/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // Define CSS selectors for video elements
    const querySelectors = [
        "#title-wrapper.ytd-video-renderer",
        "a.yt-simple-endpoint.ytd-compact-video-renderer",
        "#video-title-link.ytd-rich-grid-media"
    ];

    const sentVideoTitles = new Set();

    // Function to send video title to the recommendation system
    function sendVideoTitle(title) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "POST",
                url: 'http://localhost:3000/recommend',
                data: JSON.stringify({ title: title }),
                headers: { "Content-Type": "application/json" },
                onload: function(response) {
                    if (response.status === 200) {
                        const data = JSON.parse(response.responseText);
                        if (data !== null) {
                            resolve(data);
                        } else {
                            console.error('Invalid data received.');
                            reject('Invalid data');
                        }
                    } else {
                        console.error('Error:', response.statusText);
                        reject(response.statusText);
                    }
                }
            });
        });
    }

    // Function to send video feedback (like/dislike) to the server
    function sendVideoFeedback(title, liked) {
        GM_xmlhttpRequest({
            method: "POST",
            url: 'http://localhost:3000/addvideo',
            data: JSON.stringify({ title: title, liked: liked }),
            headers: { "Content-Type": "application/json" },
            onload: function(response) {
                if (response.status === 200) {
                    const data = JSON.parse(response.responseText);
                    if (data !== null) {
                        console.log('Server Response:', data);
                    }
                } else {
                    console.error('Error:', response.statusText);
                }
            }
        });
    }

    // Function to handle a "Like" action
    function handleLike(title) {
        sendVideoFeedback(title, 1);
    }

    // Function to handle a "Dislike" action
    function handleDislike(title) {
        sendVideoFeedback(title, 0);
    }

    // Function to create a button element with specified text and attributes
    function createButton(text, className, onClick) {
        const button = document.createElement("button");
        button.textContent = text;
        button.className = className;
        button.addEventListener("click", onClick);
        button.style.padding = "5px 10px";
        button.style.border = "none";
        button.style.borderRadius = "4px";
        button.style.marginRight = "10px";
        button.style.cursor = "pointer";
        button.style.transition = "background-color 0.3s ease-in-out";

        if (text === "Like") {
            button.style.backgroundColor = "#4CAF50";
        } else if (text === "Dislike") {
            button.style.backgroundColor = "#FF5733";
        }

        button.style.color = "white";
        button.addEventListener("mouseover", () => {
            if (text === "Like") {
                button.style.backgroundColor = "#45a049";
            } else if (text === "Dislike") {
                button.style.backgroundColor = "#e74c3c";
            }
        });
        button.addEventListener("mouseout", () => {
            if (text === "Like") {
                button.style.backgroundColor = "#4CAF50";
            } else if (text === "Dislike") {
                button.style.backgroundColor = "#FF5733";
            }
        });

        return button;
    }

    // Function to add like/dislike buttons to video elements
    function addButtons() {
        for (const q of querySelectors) {
            for (const videoRenderer of document.querySelectorAll(q)) {
                if (videoRenderer.querySelectorAll("button").length === 0) {
                    const titleElement = videoRenderer.querySelector("#video-title");
                    const videoTitle = titleElement.textContent.trim();

                    const buttonWrapper = document.createElement("div");
                    buttonWrapper.className = "like-dislike-buttons";
                    buttonWrapper.style.display = "flex";
                    buttonWrapper.style.alignItems = "center";

                    const likeButton = createButton("Like", "like-button", (event) => {
                        event.preventDefault();
                        event.stopImmediatePropagation();
                        handleLike(videoTitle);
                    });

                    const dislikeButton = createButton("Dislike", "dislike-button", (event) => {
                        event.preventDefault();
                        event.stopImmediatePropagation();
                        handleDislike(videoTitle);
                    });

                    buttonWrapper.appendChild(likeButton);
                    buttonWrapper.appendChild(dislikeButton);

                    videoRenderer.appendChild(buttonWrapper);
                }
            }
        }
    }

    // Function to scrape video titles and remove videos based on recommendations
    function scrapeVideoTitles() {
        for (const q of querySelectors) {
            for (const videoRenderer of document.querySelectorAll(q)) {
                const titleElement = videoRenderer.querySelector("#video-title");
                const videoTitle = titleElement.textContent.trim();

                if (!sentVideoTitles.has(videoTitle)) {
                    sendVideoTitle(videoTitle)
                        .then(data => {
                            if (data.recommend === 0) {
                                // Find the closest ancestor with a common class or ID
                                const removeQuery = [
                                    'ytd-rich-item-renderer',
                                    '#dismissible.ytd-compact-video-renderer',
                                ];

                                for (const qr of removeQuery) {
                                    const closestAncestor = videoRenderer.closest(qr);
                                    if (closestAncestor) {
                                        closestAncestor.remove();
                                        console.log('Video removed.');
                                        break;
                                    }
                                }
                            }
                        })
                        .catch(error => {
                            console.error('Error sending video title:', error);
                        });

                    sentVideoTitles.add(videoTitle);
                }
            }
        }
    }

    // Event listener for page load
    window.addEventListener('load', function() {
        const observer = new MutationObserver(function(mutations) {
            addButtons();
            scrapeVideoTitles();
        });

        const container = document.querySelector('ytd-app');
        observer.observe(container, {
            childList: true,
            subtree: true
        });

        scrapeVideoTitles();
        addButtons();
    });

})();
