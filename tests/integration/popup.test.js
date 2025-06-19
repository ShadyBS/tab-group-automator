import '../../popup/popup.js';

describe('popup.js', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div>
        <input type="checkbox" id="autoGroupingToggle">
        <button id="groupAllButton"></button>
        <button id="optionsButton"></button>
      </div>
    `;
    
    // Mock browser API responses
    browser.runtime.sendMessage.mockResolvedValue({
      autoGroupingEnabled: true
    });
  });

  test('should initialize popup state', async () => {
    // Trigger DOMContentLoaded
    const event = new Event('DOMContentLoaded');
    document.dispatchEvent(event);
    
    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Should request settings
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'getSettings'
    });
    
    // Should update toggle state
    expect(document.getElementById('autoGroupingToggle').checked).toBe(true);
  });

  test('should handle toggle change', async () => {
    // Trigger initialization
    const event = new Event('DOMContentLoaded');
    document.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Change toggle
    const toggle = document.getElementById('autoGroupingToggle');
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));
    
    // Should send update message
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'updateSettings',
      settings: { autoGroupingEnabled: false }
    });
  });

  test('should handle group all button click', async () => {
    // Trigger initialization
    const event = new Event('DOMContentLoaded');
    document.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Click button
    const button = document.getElementById('groupAllButton');
    button.click();
    
    // Should show loading state
    expect(button.innerHTML).toContain('Agrupando...');
    
    // Should send group all message
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'groupAllTabs'
    });
  });
});