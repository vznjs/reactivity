import { schedule } from '../src/scheduler';

jest.useFakeTimers('modern');

describe('schedule', () => {
  it('batches updates', () => {
    const spy = jest.fn();
    
    schedule(spy);
    schedule(spy);
    
    expect(spy.mock.calls.length).toBe(0);
    
    jest.runAllTimers();
    
    expect(spy.mock.calls.length).toBe(1);
  });
});
