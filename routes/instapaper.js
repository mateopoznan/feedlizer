const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const router = express.Router();

const INSTAPAPER_API_BASE = 'https://www.instapaper.com/api/1';

// OAuth 1.0a signature generation for Instapaper
function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret = '') {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  
  return crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');
}

// Add article to Instapaper
router.post('/add', async (req, res) => {
  try {
    const { url, title, description } = req.body;
    
    const consumerKey = process.env.INSTAPAPER_CONSUMER_KEY;
    const consumerSecret = process.env.INSTAPAPER_CONSUMER_SECRET;
    const username = process.env.INSTAPAPER_USERNAME;
    const password = process.env.INSTAPAPER_PASSWORD;

    if (!consumerKey || !consumerSecret || !username || !password) {
      return res.status(401).json({ error: 'Instapaper credentials not configured' });
    }

    // OAuth parameters
    const oauthParams = {
      oauth_consumer_key: consumerKey,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_version: '1.0'
    };

    // Request parameters
    const requestParams = {
      ...oauthParams,
      username,
      password,
      url,
      ...(title && { title }),
      ...(description && { description })
    };

    // Generate signature
    const signature = generateOAuthSignature(
      'POST',
      `${INSTAPAPER_API_BASE}/bookmarks/add`,
      requestParams,
      consumerSecret
    );

    requestParams.oauth_signature = signature;

    // Make request
    const response = await axios.post(
      `${INSTAPAPER_API_BASE}/bookmarks/add`,
      new URLSearchParams(requestParams).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    if (response.status === 201) {
      res.json({ success: true, message: 'Article added to Instapaper successfully' });
    } else {
      res.status(400).json({ error: 'Failed to add article to Instapaper' });
    }

  } catch (error) {
    console.error('Instapaper add error:', error.response?.data || error.message);
    
    if (error.response?.status === 400) {
      res.status(400).json({ error: 'Invalid request to Instapaper' });
    } else if (error.response?.status === 403) {
      res.status(403).json({ error: 'Invalid Instapaper credentials' });
    } else if (error.response?.status === 500) {
      res.status(500).json({ error: 'Instapaper service error' });
    } else {
      res.status(500).json({ error: 'Failed to add article to Instapaper' });
    }
  }
});

// Get Instapaper bookmarks (optional - for verification)
router.get('/bookmarks', async (req, res) => {
  try {
    const consumerKey = process.env.INSTAPAPER_CONSUMER_KEY;
    const consumerSecret = process.env.INSTAPAPER_CONSUMER_SECRET;
    const username = process.env.INSTAPAPER_USERNAME;
    const password = process.env.INSTAPAPER_PASSWORD;

    if (!consumerKey || !consumerSecret || !username || !password) {
      return res.status(401).json({ error: 'Instapaper credentials not configured' });
    }

    const oauthParams = {
      oauth_consumer_key: consumerKey,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_version: '1.0'
    };

    const requestParams = {
      ...oauthParams,
      username,
      password,
      limit: req.query.limit || '10'
    };

    const signature = generateOAuthSignature(
      'POST',
      `${INSTAPAPER_API_BASE}/bookmarks/list`,
      requestParams,
      consumerSecret
    );

    requestParams.oauth_signature = signature;

    const response = await axios.post(
      `${INSTAPAPER_API_BASE}/bookmarks/list`,
      new URLSearchParams(requestParams).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    res.json(response.data);

  } catch (error) {
    console.error('Instapaper bookmarks error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch Instapaper bookmarks' });
  }
});

module.exports = router;
