const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const natural = require('natural');

const app = express();
const port = 3000;
const dataFilePath = 'videos.json';
const maxVideos = 1000000; // Maximum number of videos in the dataset
const minVideos = 10; // Minimum number

// Initialize the Bayes classifier
const classifier = new natural.BayesClassifier();

// Function to read video data from the file and train the classifier
function readVideoDataAndTrainClassifier() {
  try {
    const data = fs.readFileSync(dataFilePath, 'utf-8');
    const videosData = JSON.parse(data).slice(0, maxVideos);

    // Train the classifier with video titles and sentiments
    videosData.forEach(video => {
      classifier.addDocument(video.title, video.liked ? 'liked' : 'disliked');
    });
    classifier.train();

    return videosData;
  } catch (error) {
    return [];
  }
}

// Function to write video data to the file
function writeVideoData(data) {
  fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
}

// Read video data from the file and train the classifier when starting the server
const videos = readVideoDataAndTrainClassifier();

// Middleware for JSON parsing
app.use(bodyParser.json());

// Route to add a new video
app.post('/addvideo', (req, res) => {
  const { title, liked } = req.body;

  if (typeof title !== 'string' || typeof liked !== 'number' || (liked !== 0 && liked !== 1)) {
      return res.status(400).json({ error: 'Invalid input. Please provide a title (string) and liked status (0 or 1).' });
  }

  // Check if the video already exists in the database
  const existingVideoIndex = videos.findIndex(video => video.title === title);

  if (existingVideoIndex !== -1) {
      // Video already exists; check if the liked status has changed
      if (videos[existingVideoIndex].liked !== liked) {
          // Liked status has changed; update the liked status
          videos[existingVideoIndex].liked = liked;

          // Update and save the video data to the file
          writeVideoData(videos);

          // Retrain the classifier
          classifier.addDocument(title, liked ? 'liked' : 'disliked');
          classifier.train();

          console.log(`Updated video: ${title}, liked: ${liked} in the database`);
      } else {
          console.log(`Video: ${title} already exists with the same liked status.`);
      }
  } else {
      // Video doesn't exist in the database; add it
      const newVideo = { title, liked };

      // Add the new video to the beginning of the array
      videos.unshift(newVideo);

      // Trim the video list to the latest 1000 videos
      if (videos.length > maxVideos) {
          videos.pop(); // Remove the oldest video
      }

      // Update and save the video data to the file
      writeVideoData(videos);

      // Retrain the classifier
      classifier.addDocument(newVideo.title, newVideo.liked ? 'liked' : 'disliked');
      classifier.train();

      console.log(`Added video: ${title}, liked: ${liked} to the database`);
  }

  res.json({ message: 'Video added or updated successfully.', videos });
});
    
// Route to get video recommendations based on user preferences
app.post('/recommend', (req, res) => {
  const { title } = req.body;

  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'Invalid input. Please provide a valid video title.' });
  }

  // Calculate the threshold (adjust as needed)
  const threshold = 0.4;

  const titleToClassify = title;
  if (videos.length > minVideos) {
    const classifications = classifier.getClassifications(titleToClassify);

    // Find the "liked" and "disliked" labels
    const likedLabel = classifications.find(c => c.label === 'liked');
    const dislikedLabel = classifications.find(c => c.label === 'disliked');
    console.log(`Liked: ${likedLabel.value}\nDisliked: ${dislikedLabel.value}`);
    const finalThreshold = (likedLabel.value + dislikedLabel.value) * threshold;

    // Check if "disliked" is greater than "liked," and set recommend accordingly
    if (dislikedLabel && likedLabel && dislikedLabel.value > likedLabel.value) {
      const recommendation = {
        title: title,
        recommend: 0, // Do not recommend
      };
      res.json(recommendation);
    } else {
      // Check only the "liked" label against the threshold
      const recommend = likedLabel && likedLabel.value >= finalThreshold ? 1 : 0;
      const recommendation = {
        title: title,
        recommend: recommend,
      };
      res.json(recommendation);
    }
  } else {
    const recommendation = {
      title: title,
      recommend: 1, // Recommend by default
    };
    res.json(recommendation);
  }
});   
  
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});