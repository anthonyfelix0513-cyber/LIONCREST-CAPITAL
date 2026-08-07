/* Lioncrest Capital — envoi d'e-mails via EmailJS (aucun serveur requis) */
(function(){
  "use strict";

  const EMAILJS_PUBLIC_KEY  = "bHEV_KywHZUudBQar";
  const EMAILJS_SERVICE_ID  = "service_0z4quhl";
  const EMAILJS_TEMPLATE_ID = "template_yal8xm5";

  if(window.emailjs && window.emailjs.init){
    window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  }

  window.LioncrestMail = {
    send: function(params){
      if(!window.emailjs){
        return Promise.reject(new Error("EmailJS n'est pas chargé."));
      }
      return window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params);
    }
  };
})();
