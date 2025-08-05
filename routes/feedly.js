const express = require('express');
const axios = require('axios');
const router = express.Router();

const FEEDLY_API_BASE = 'https://cloud.feedly.com/v3';

// Get user profile and streams
router.get('/profile', async (req, res) => {
  try {
    const token = process.env.FEEDLY_ACCESS_TOKEN;
    if (!token) {
      return res.status(401).json({ error: 'Feedly access token not configured' });
    }

    const response = await axios.get(`${FEEDLY_API_BASE}/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Feedly profile error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch Feedly profile' });
  }
});

// Get subscriptions
router.get('/subscriptions', async (req, res) => {
  try {
    const token = process.env.FEEDLY_ACCESS_TOKEN;
    if (!token) {
      return res.status(401).json({ error: 'Feedly access token not configured' });
    }

    const response = await axios.get(`${FEEDLY_API_BASE}/subscriptions`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Feedly subscriptions error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// Get stream entries (articles)
router.get('/stream', async (req, res) => {
  try {
    const token = process.env.FEEDLY_ACCESS_TOKEN;
    if (!token) {
      return res.status(401).json({ error: 'Feedly access token not configured' });
    }

    const { streamId = 'user/global.all', count = 20, unreadOnly = 'true' } = req.query;
    
    const response = await axios.get(`${FEEDLY_API_BASE}/streams/contents`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        streamId: decodeURIComponent(streamId),
        count,
        unreadOnly
      }
    });

    // Transform articles to include better image handling
    const transformedItems = response.data.items.map(item => ({
      id: item.id,
      title: item.title,
      summary: item.summary?.content || item.content?.content || 'No summary available',
      url: item.canonicalUrl || item.alternate?.[0]?.href,
      published: item.published,
      author: item.author,
      source: {
        title: item.origin?.title,
        website: item.origin?.htmlUrl
      },
      visual: item.visual?.url || item.enclosure?.[0]?.href || null,
      tags: item.tags?.map(tag => tag.label) || [],
      engagement: item.engagement || 0
    }));

    res.json({
      ...response.data,
      items: transformedItems
    });

  } catch (error) {
    console.error('Feedly stream error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// Mark article as read
router.post('/markers', async (req, res) => {
  try {
    const token = process.env.FEEDLY_ACCESS_TOKEN;
    if (!token) {
      return res.status(401).json({ error: 'Feedly access token not configured' });
    }

    const { action, type, entryIds } = req.body;

    const response = await axios.post(`${FEEDLY_API_BASE}/markers`, {
      action, // 'markAsRead' or 'markAsUnread'
      type,   // 'entries'
      entryIds
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Feedly markers error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to mark article' });
  }
});

// Save article for later (add to saved category)
router.post('/tags/:entryId', async (req, res) => {
  try {
    const token = process.env.FEEDLY_ACCESS_TOKEN;
    if (!token) {
      return res.status(401).json({ error: 'Feedly access token not configured' });
    }

    const { entryId } = req.params;
    const { userId } = req.body; // Will need to get this from profile

    const response = await axios.put(`${FEEDLY_API_BASE}/tags/user%2F${userId}%2Ftag%2Fglobal.saved`, {
      entryId: decodeURIComponent(entryId)
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Feedly save error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to save article' });
  }
});

module.exports = router;
