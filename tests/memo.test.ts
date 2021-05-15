import { createMemo } from '../src/memo';
import { createReaction } from '../src/reaction';
import { createValue } from '../src/value';
import { onCleanup } from '../src/disposer';
import { runWithOwner } from '../src/owner';
import { createQueue, flushQueue } from '../src/queue';

jest.useFakeTimers('modern');

describe('createMemo', () => {  
  it('does recompute once only if changed', () => {
    const [getSignal, setSignal] = createValue(1);
    const spy = jest.fn();
    
    const getMemo = createMemo(() => {
      getSignal();
      spy();
    });
    
    setSignal(2);
    
    expect(spy.mock.calls.length).toBe(0);
    
    getMemo();
    getMemo();
    
    expect(spy.mock.calls.length).toBe(1);
    
    setSignal(3);
    setSignal(4);
    
    getMemo();
    
    expect(spy.mock.calls.length).toBe(2);
  });
  
  it('schedules only one recomputation', () => {
    const [getSignal, setSignal] = createValue(1);
    const spy = jest.fn();
    
    expect(spy.mock.calls.length).toBe(0);

    const getMemo = createMemo(() => {
      getSignal();
      spy();
    });

    createReaction(() => {
      getMemo();
    })
    
    expect(spy.mock.calls.length).toBe(1);

    setSignal(2);
    setSignal(3);
    
    expect(spy.mock.calls.length).toBe(1);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(2);
  });
  
  it('does recompute on every change in reaction', () => {
    const [getSignal, setSignal] = createValue(1);
    const disposer = createQueue();
    const spy = jest.fn();
    
    runWithOwner({ disposer }, () => {
      expect(spy.mock.calls.length).toBe(0);

      const getMemo = createMemo(() => {
        getSignal();
        spy();
      });
  
      expect(spy.mock.calls.length).toBe(0);

      createReaction(() => {
        getMemo();
      })
      
      expect(spy.mock.calls.length).toBe(1);
  
      setSignal(2);
      setSignal(3);

      jest.runAllTimers();

      expect(spy.mock.calls.length).toBe(2);
      
      getMemo();
  
      expect(spy.mock.calls.length).toBe(2);
      
      flushQueue(disposer);
      
      setSignal(4);

      jest.runAllTimers();
  
      expect(spy.mock.calls.length).toBe(2);
      
      getMemo();
  
      expect(spy.mock.calls.length).toBe(3);
    })
  });
  
  it('cleanups with each recomputation', () => {
    const spy = jest.fn();
    
    const [getSignal, setSignal] = createValue(1);
    const disposer = createQueue();
    
    runWithOwner({ disposer }, () => {
      const getMemo = createMemo(() => {
        onCleanup(spy);
        getSignal();
      });

      getMemo();

      expect(spy.mock.calls.length).toBe(0);
      
      flushQueue(disposer);
      
      expect(spy.mock.calls.length).toBe(1);
      
      getMemo();
      
      setSignal(2);
      
      getMemo();

      expect(spy.mock.calls.length).toBe(2);
    })
  });
});
