import { 
  recentlyCreatedAutomaticGroups, 
  pendingClassificationGroups,
  injectionFailureMap
} from '../../app-state.js';

describe('app-state', () => {
  beforeEach(() => {
    recentlyCreatedAutomaticGroups.clear();
    pendingClassificationGroups.clear();
    injectionFailureMap.clear();
  });

  test('should manage recentlyCreatedAutomaticGroups', () => {
    recentlyCreatedAutomaticGroups.add(1001);
    recentlyCreatedAutomaticGroups.add(1002);
    
    expect(recentlyCreatedAutomaticGroups.has(1001)).toBe(true);
    expect(recentlyCreatedAutomaticGroups.size).toBe(2);
    
    recentlyCreatedAutomaticGroups.delete(1001);
    expect(recentlyCreatedAutomaticGroups.size).toBe(1);
  });

  test('should manage pendingClassificationGroups', () => {
    pendingClassificationGroups.add(2001);
    expect(pendingClassificationGroups.has(2001)).toBe(true);
    
    pendingClassificationGroups.clear();
    expect(pendingClassificationGroups.size).toBe(0);
  });

  test('should manage injectionFailureMap', () => {
    injectionFailureMap.set(3001, 2);
    expect(injectionFailureMap.get(3001)).toBe(2);
    
    injectionFailureMap.set(3001, 3);
    expect(injectionFailureMap.get(3001)).toBe(3);
    
    injectionFailureMap.delete(3001);
    expect(injectionFailureMap.has(3001)).toBe(false);
  });
});