import { createQueue, flushQueue } from "../src/queue";

describe('createQueue', () => {
  it('schedules and flushes', () => {
    const spy = jest.fn();
    const queue = createQueue();

    queue.add(spy);
    
    expect(spy.mock.calls.length).toBe(0);
    
    flushQueue(queue);

    expect(spy.mock.calls.length).toBe(1);
  });
});