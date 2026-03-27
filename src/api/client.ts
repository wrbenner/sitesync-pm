// Mock API client with realistic delays
// When switching to a real backend, replace this with actual fetch/axios calls.

const DELAY_MIN = 200;
const DELAY_MAX = 600;

function randomDelay(): number {
  return DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN);
}

export async function mockFetch<T>(data: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), randomDelay());
  });
}

export async function mockFetchWithError<T>(data: T, errorRate = 0): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < errorRate) {
        reject(new Error('Network error. Please try again.'));
      } else {
        resolve(data);
      }
    }, randomDelay());
  });
}
