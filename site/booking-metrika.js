(function(){
  "use strict";

  document.addEventListener('click', function(event){
    var link = event.target.closest('[data-metrika-goal]');
    if(!link || typeof window.ym !== 'function'){ return; }

    var goal = link.getAttribute('data-metrika-goal');
    if(goal){ window.ym(109936294, 'reachGoal', goal); }
  });
})();
