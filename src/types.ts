import { z } from 'zod';

// Configuration schema with validation
export const ConfigSchema = z.object({
    apiKey: z.string().min(1, 'API Key is required'),
    apiSecretKey: z.string().min(1, 'API Secret Key is required'),
    accessToken: z.string().min(1, 'Access Token is required'),
    accessTokenSecret: z.string().min(1, 'Access Token Secret is required')
});

export type Config = z.infer<typeof ConfigSchema>;

// Tool input schemas
export const PostTweetSchema = z.object({
    text: z.string()
        .min(1, 'Tweet text cannot be empty')
        .max(280, 'Tweet cannot exceed 280 characters'),
    reply_to_tweet_id: z.string().optional()
});

const iso8601 = z.string().regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,
    'Must be ISO 8601 UTC, e.g. 2026-08-20T00:00:00Z'
);

export const SearchTweetsSchema = z.object({
    query: z.string().min(1, 'Search query cannot be empty'),
    count: z.number()
        .int('Count must be an integer')
        .min(10, 'Minimum count is 10')
        .max(100, 'Maximum count is 100'),
    // Recent search spans the last 7 days by default. Bounding the window is
    // the difference between paying for one day of tweets and re-paying for
    // the same week on every run.
    start_time: iso8601.optional(),
    end_time: iso8601.optional(),
    since_id: z.string().regex(/^\d+$/, 'since_id must be a tweet ID').optional()
});

export interface SearchWindow {
    start_time?: string;
    end_time?: string;
    since_id?: string;
}

export type PostTweetArgs = z.infer<typeof PostTweetSchema>;
export type SearchTweetsArgs = z.infer<typeof SearchTweetsSchema>;

// API Response types
export interface TweetMetrics {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
}

export interface PostedTweet {
    id: string;
    text: string;
}

export interface MediaItem {
    type: string;
    url: string | null;
    preview_image_url: string | null;
}

export interface Tweet {
    id: string;
    text: string;
    authorId: string;
    metrics: TweetMetrics;
    createdAt: string;
    media: MediaItem[];
}

export interface TwitterUser {
    id: string;
    username: string;
}

// Error types
export class TwitterError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly status?: number
    ) {
        super(message);
        this.name = 'TwitterError';
    }

    static isRateLimit(error: unknown): error is TwitterError {
        return error instanceof TwitterError && error.code === 'rate_limit_exceeded';
    }
}

// Response formatter types
export interface FormattedTweet {
    position: number;
    author: {
        username: string;
    };
    content: string;
    createdAt: string;
    metrics: TweetMetrics;
    media: MediaItem[];
    url: string;
}

export interface SearchResponse {
    query: string;
    count: number;
    tweets: FormattedTweet[];
}