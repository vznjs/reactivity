import { untrack } from '../src/untrack';
import { onCleanup } from '../src/disposer';
import { getOwner, runWithOwner } from '../src/owner';
import { createQueue, flushQueue } from '../src/queue';

jest.useFakeTimers('modern');

describe('untrack', () => {
  it('runs without any computation', () => {
    const computation = () => {};
    
    expect(getOwner().computation).toBeUndefined();
    
    runWithOwner({ computation }, () => {
      expect(getOwner().computation).toBe(computation);
      
      untrack(() => {
        expect(getOwner().computation).toBeUndefined();
      });

      expect(getOwner().computation).toBe(computation);
    });
    
    expect(getOwner().computation).toBeUndefined();
  });

  it('runs cleanups in computation correctly', () => {
    const disposer = createQueue();
    const cleanupMock = jest.fn();
    
    expect(getOwner().disposer).toBeUndefined();
    
    runWithOwner({ disposer }, () => {
      untrack(() => {
        onCleanup(cleanupMock)
      });
    });
    
    expect(cleanupMock.mock.calls.length).toBe(0);

    flushQueue(disposer);
    
    expect(cleanupMock.mock.calls.length).toBe(1);
  });
});