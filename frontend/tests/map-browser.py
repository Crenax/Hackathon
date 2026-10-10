"""Chromium checks for the map UI. Run with Vite on MAP_URL (default localhost:5174)."""
import json
import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select

options = Options()
for argument in ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,1100']:
    options.add_argument(argument)
options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
driver = webdriver.Chrome(service=Service('/usr/bin/chromedriver'), options=options)
wait = WebDriverWait(driver, 60)
try:
    driver.get(os.getenv('MAP_URL', 'http://127.0.0.1:5174') + '/map')
    wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, '.campus-shape'))
    assert driver.find_element(By.CSS_SELECTOR, 'h1').text == 'A little help finding your way.'
    fields = driver.find_elements(By.CSS_SELECTOR, '.campus-directions input')
    fields[0].send_keys('HG E26.1')
    fields[1].send_keys('HG F5')
    def submit():
        driver.find_element(By.CSS_SELECTOR, '.campus-primary').click()
        wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, '.campus-route'))
        assert driver.find_elements(By.CSS_SELECTOR, '.campus-route-line')
    submit()
    assert 'HG F 5' in driver.find_element(By.CSS_SELECTOR, '.campus-route').text
    driver.find_elements(By.CSS_SELECTOR, '.campus-route li button')[-1].click()
    assert Select(driver.find_elements(By.CSS_SELECTOR, '.campus-map-toolbar select')[1]).first_selected_option.get_attribute('value') == 'ETH.HG.F'
    Select(driver.find_elements(By.CSS_SELECTOR, '.campus-directions select')[-1]).select_by_value('elevator')
    submit()
    assert 'elevator' in driver.find_element(By.CSS_SELECTOR, '.campus-route').text
    Select(driver.find_elements(By.CSS_SELECTOR, '.campus-directions select')[0]).select_by_value('toilet')
    submit()
    assert 'Toilet' in driver.find_element(By.CSS_SELECTOR, '.campus-route').text
    # Controlled schedules test availability integration without depending on ETH/network/time of day.
    driver.execute_script("""
      const realFetch = window.fetch;
      window.fetch = (url, config) => String(url).startsWith('/api/lecture-halls')
        ? Promise.resolve(new Response(JSON.stringify({checkedAt:new Date().toISOString(),windowEndsAt:new Date(Date.now()+1800000).toISOString(),rooms:[{name:'HG F 5',status:'free',freeUntil:null,freeForRestOfDay:true}]}), {status:200,headers:{'Content-Type':'application/json'}}))
        : realFetch(url,config);
    """)
    Select(driver.find_elements(By.CSS_SELECTOR, '.campus-directions select')[0]).select_by_value('lecture')
    submit()
    assert 'Free for the rest of today' in driver.find_element(By.CSS_SELECTOR, '.campus-route').text
    # Inject a position inside a real mapped room; exercise the same watch callback as GPS.
    driver.execute_async_script("""
      const done=arguments[0];
      fetch('/campus/map.json').then(r=>r.json()).then(data=>{
        const router=HGRouting.create(ArcGISData.normalize(data)), room=router.findRoom('HG E26.1'), b=room.geometry.bounds;
        const x=(b[0]+b[2])/2,y=(b[1]+b[3])/2;
        navigator.geolocation.watchPosition = success => {setTimeout(()=>success({coords:{longitude:x/6378137*180/Math.PI,latitude:(2*Math.atan(Math.exp(y/6378137))-Math.PI/2)*180/Math.PI,accuracy:4},timestamp:Date.now()}),10);return 1;};
        navigator.geolocation.clearWatch = ()=>{}; done();
      });
    """)
    Select(driver.find_elements(By.CSS_SELECTOR, '.campus-map-toolbar select')[1]).select_by_value('ETH.HG.E')
    driver.find_element(By.CSS_SELECTOR, '.campus-location-button').click()
    wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, '.campus-position'))
    submit()
    assert 'Your location' in driver.find_element(By.CSS_SELECTOR, '.campus-route').text
    driver.save_screenshot('/tmp/campus-map-desktop.png')
    Select(driver.find_elements(By.CSS_SELECTOR, '.campus-directions select')[0]).select_by_value('toilet')
    submit()
    Select(driver.find_elements(By.CSS_SELECTOR, '.campus-directions select')[0]).select_by_value('room')
    driver.find_elements(By.CSS_SELECTOR, '.campus-directions input')[1].clear()
    driver.find_elements(By.CSS_SELECTOR, '.campus-directions input')[1].send_keys('HG F5')
    submit()
    assert 'Your location' in driver.find_element(By.CSS_SELECTOR, '.campus-route').text
    driver.find_element(By.CSS_SELECTOR, '.campus-locate').click()
    assert not driver.find_elements(By.CSS_SELECTOR, '.campus-position')
    driver.set_window_size(390, 844)
    driver.find_element(By.CSS_SELECTOR, '.app-header-menu-button').click()
    assert driver.find_element(By.CSS_SELECTOR, '.app-sidebar a[href="/map"]').is_displayed()
    driver.find_element(By.CSS_SELECTOR, '.app-header-menu-button').click()
    driver.save_screenshot('/tmp/campus-map-mobile.png')
    assert driver.execute_script('return document.documentElement.scrollWidth <= innerWidth')
    errors = [entry for entry in driver.get_log('browser') if entry['level'] == 'SEVERE']
    assert not errors, errors
    print('PASS: room, elevator, toilet, free lecture room, GPS routes, tracking cleanup, floors, and mobile navigation')
finally:
    driver.quit()
