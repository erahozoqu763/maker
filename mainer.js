(function() {
    const img = document.getElementById('fanImg');

    function startSpin(secondsPerTurn = 2.5, isBoost = false) {
        document.documentElement.style.setProperty('--spin-speed', `${secondsPerTurn}s`);
        img.classList.add('spinning');
        img.classList.toggle('boosting', !!isBoost);
    }

    function stopSpin() {
        img.classList.remove('spinning', 'boosting');
    }

    // тестова демо-анімація
    let boosted = false;
    document.getElementById('buy').addEventListener('click', () => {
        alert('Ви купили 100 SC!');
    });

    document.getElementById('charge').addEventListener('click', () => {
        boosted = !boosted;
        if (boosted) {
            startSpin(0.8, true);
        } else {
            startSpin(2.5, false);
        }
    });

    // старт повільного обертання
    startSpin(2.5, false);

    window._fan = { startSpin, stopSpin };
})();
