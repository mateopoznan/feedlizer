javascript:(function(){
    var url = encodeURIComponent(window.location.href);
    var title = encodeURIComponent(document.title);
    window.open('https://news.mateopoznan.pl/admin?url='+url+'&title='+title, '_blank');
})();
