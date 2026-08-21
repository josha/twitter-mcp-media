import { TwitterApi } from 'twitter-api-v2';
import { Config, TwitterError, Tweet, TwitterUser, PostedTweet, MediaItem, SearchWindow } from './types.js';

export class TwitterClient {
  private client: TwitterApi;
  private rateLimitMap = new Map<string, number>();

  constructor(config: Config) {
    this.client = new TwitterApi({
      appKey: config.apiKey,
      appSecret: config.apiSecretKey,
      accessToken: config.accessToken,
      accessSecret: config.accessTokenSecret,
    });

    console.error('Twitter API client initialized');
  }

  async postTweet(text: string, replyToTweetId?: string): Promise<PostedTweet> {
    try {
      const endpoint = 'tweets/create';
      await this.checkRateLimit(endpoint);

      const tweetOptions: any = { text };
      if (replyToTweetId) {
        tweetOptions.reply = { in_reply_to_tweet_id: replyToTweetId };
      }

      const response = await this.client.v2.tweet(tweetOptions);
      
      console.error(`Tweet posted successfully with ID: ${response.data.id}${replyToTweetId ? ` (reply to ${replyToTweetId})` : ''}`);
      
      return {
        id: response.data.id,
        text: response.data.text
      };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  async searchTweets(
    query: string,
    count: number,
    window: SearchWindow = {}
  ): Promise<{ tweets: Tweet[], users: TwitterUser[] }> {
    try {
      const endpoint = 'tweets/search';
      await this.checkRateLimit(endpoint);

      const response = await this.client.v2.search(query, {
        max_results: count,
        expansions: ['author_id', 'attachments.media_keys'],
        // note_tweet carries the untruncated body of posts over 280 chars;
        // `text` alone comes back clipped with an ellipsis.
        'tweet.fields': ['public_metrics', 'created_at', 'attachments', 'note_tweet'],
        'user.fields': ['username', 'name', 'verified'],
        'media.fields': ['url', 'preview_image_url', 'type'],
        ...(window.start_time ? { start_time: window.start_time } : {}),
        ...(window.end_time ? { end_time: window.end_time } : {}),
        ...(window.since_id ? { since_id: window.since_id } : {})
      });

      const bounds = [
        window.start_time ? `since ${window.start_time}` : null,
        window.end_time ? `until ${window.end_time}` : null,
        window.since_id ? `after id ${window.since_id}` : null
      ].filter(Boolean).join(', ') || 'last 7 days (unbounded)';
      console.error(
        `Fetched ${response.tweets.length} tweets (cap ${count}, ${bounds}) for query: "${query}"`
      );

      const mediaByKey = new Map<string, MediaItem>();
      const includedMedia = (response.includes as any)?.media;
      if (Array.isArray(includedMedia)) {
        for (const m of includedMedia) {
          mediaByKey.set(m.media_key, {
            type: m.type ?? 'unknown',
            url: m.url ?? null,
            preview_image_url: m.preview_image_url ?? null
          });
        }
      }

      const tweets = response.tweets.map(tweet => {
        const keys = (tweet as any).attachments?.media_keys ?? [];
        const media = keys
          .map((k: string) => mediaByKey.get(k))
          .filter((m: MediaItem | undefined): m is MediaItem => Boolean(m));
        const noteText = (tweet as any).note_tweet?.text;
        return {
          id: tweet.id,
          text: noteText ?? tweet.text,
          authorId: tweet.author_id ?? '',
          metrics: {
            likes: tweet.public_metrics?.like_count ?? 0,
            retweets: tweet.public_metrics?.retweet_count ?? 0,
            replies: tweet.public_metrics?.reply_count ?? 0,
            quotes: tweet.public_metrics?.quote_count ?? 0
          },
          createdAt: tweet.created_at ?? '',
          media
        };
      });

      const users = response.includes.users.map(user => ({
        id: user.id,
        username: user.username,
        name: user.name,
        verified: user.verified ?? false
      }));

      return { tweets, users };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  private async checkRateLimit(endpoint: string): Promise<void> {
    const lastRequest = this.rateLimitMap.get(endpoint);
    if (lastRequest) {
      const timeSinceLastRequest = Date.now() - lastRequest;
      if (timeSinceLastRequest < 1000) { // Basic rate limiting
        throw new TwitterError(
          'Rate limit exceeded',
          'rate_limit_exceeded',
          429
        );
      }
    }
    this.rateLimitMap.set(endpoint, Date.now());
  }

  private handleApiError(error: unknown): never {
    if (error instanceof TwitterError) {
      throw error;
    }

    // Handle twitter-api-v2 errors
    const apiError = error as any;
    if (apiError.code) {
      throw new TwitterError(
        apiError.message || 'Twitter API error',
        apiError.code,
        apiError.status
      );
    }

    // Handle unexpected errors
    console.error('Unexpected error in Twitter client:', error);
    throw new TwitterError(
      'An unexpected error occurred',
      'internal_error',
      500
    );
  }
}