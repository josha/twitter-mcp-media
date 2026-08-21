import { FormattedTweet, Tweet, TwitterUser, SearchResponse } from './types.js';

export class ResponseFormatter {
  static formatTweet(tweet: Tweet, user: TwitterUser, position: number): FormattedTweet {
    return {
      position,
      author: {
        username: user.username
      },
      content: tweet.text,
      createdAt: tweet.createdAt,
      metrics: tweet.metrics,
      media: tweet.media ?? [],
      url: `https://twitter.com/${user.username}/status/${tweet.id}`
    };
  }

  static formatSearchResponse(
    query: string,
    tweets: Tweet[],
    users: TwitterUser[]
  ): SearchResponse {
    const userMap = new Map(users.map(user => [user.id, user]));
    
    const formattedTweets = tweets
      .map((tweet, index) => {
        const user = userMap.get(tweet.authorId);
        if (!user) return null;
        
        return this.formatTweet(tweet, user, index + 1);
      })
      .filter((tweet): tweet is FormattedTweet => tweet !== null);

    return {
      query,
      count: formattedTweets.length,
      tweets: formattedTweets
    };
  }

  static toMcpResponse(response: SearchResponse): string {
    const header = [
      'TWITTER SEARCH RESULTS',
      `Query: "${response.query}"`,
      `Found ${response.count} tweets`,
      '='
    ].join('\n');

    if (response.count === 0) {
      return header + '\nNo tweets found matching your query.';
    }

    const tweetBlocks = response.tweets.map(tweet => {
      const lines = [
        `Tweet #${tweet.position}`,
        `From: @${tweet.author.username}`,
        `Content: ${tweet.content}`,
        `Posted: ${tweet.createdAt || '(unavailable)'}`,
        `Metrics: ${tweet.metrics.likes} likes, ${tweet.metrics.retweets} retweets, ` +
          `${tweet.metrics.replies} replies, ${tweet.metrics.quotes} quotes`,
      ];
      if (tweet.media && tweet.media.length > 0) {
        const mediaParts = tweet.media.map(m =>
          `${m.type}:${m.url ?? m.preview_image_url ?? '?'}`
        );
        lines.push(`Media: ${mediaParts.join(', ')}`);
      } else {
        lines.push('Media: (none)');
      }
      lines.push(`URL: ${tweet.url}`);
      lines.push('=');
      return lines.join('\n');
    });

    return [header, ...tweetBlocks].join('\n\n');
  }
}