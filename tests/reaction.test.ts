import { onCleanup } from '../src/disposer';
import { createReaction } from '../src/reaction';
import { runWithOwner } from '../src/owner';
import { createQueue, flushQueue } from '../src/queue';
import { createValue } from '../src/value';

jest.useFakeTimers('modern');

describe('createReaction', () => {
  it('reruns and cleanups on change', () => {
    const [getSignal, setSignal] = createValue(1);
    const disposer = createQueue();
    const reactionSpy = jest.fn();
    const cleanupSpy = jest.fn();

    runWithOwner({ disposer }, () => {
      createReaction(() => {
        onCleanup(cleanupSpy);
        reactionSpy();
        getSignal();
      });
    })
    
    expect(reactionSpy.mock.calls.length).toBe(1);
    expect(cleanupSpy.mock.calls.length).toBe(0);

    setSignal(2);
    jest.runAllTimers();

    expect(reactionSpy.mock.calls.length).toBe(2);
    expect(cleanupSpy.mock.calls.length).toBe(1);
    
    setSignal(3);
    jest.runAllTimers();

    expect(reactionSpy.mock.calls.length).toBe(3);
    expect(cleanupSpy.mock.calls.length).toBe(2);
    
    flushQueue(disposer);
    
    expect(reactionSpy.mock.calls.length).toBe(3);
    expect(cleanupSpy.mock.calls.length).toBe(3);
    
    setSignal(4);
    jest.runAllTimers();
    
    expect(reactionSpy.mock.calls.length).toBe(3);
    expect(cleanupSpy.mock.calls.length).toBe(3);
  });

  it('works with built-in async batching', () => {
    const [getSignal, setSignal] = createValue('start');
    
    createReaction(() => {
      setSignal('reaction');
      getSignal();
    });
    
    expect(getSignal()).toBe('reaction');
    
    setSignal('order');
    
    expect(getSignal()).toBe('order');

    jest.runAllTimers();

    expect(getSignal()).toBe('reaction');
  });

  it('is batching updates', () => {
    const [getSignal, setSignal] = createValue('start');
    const spy = jest.fn();

    createReaction(() => {
      setSignal('reaction1');
      setSignal('reaction2');
      getSignal();
      spy();
    });

    expect(spy.mock.calls.length).toBe(1);
    
    expect(getSignal()).toBe('reaction2');
    
    setSignal('order');
    
    expect(getSignal()).toBe('order');

    jest.runAllTimers();

    expect(getSignal()).toBe('reaction2');
    expect(spy.mock.calls.length).toBe(2);
  });

  it('works with nested reactions', () => {
    const spy = jest.fn();
    const [getSignal, setSignal] = createValue(false);
    
    createReaction(() => {
      if (!getSignal()) return;
      createReaction(() => spy(getSignal()));
    });

    expect(spy.mock.calls.length).toBe(0);
    
    setSignal(true);

    jest.runAllTimers();
    
    expect(spy.mock.calls.length).toBe(1);
    
    setSignal(false);

    jest.runAllTimers();
    
    expect(spy.mock.calls.length).toBe(1);
  });
});
