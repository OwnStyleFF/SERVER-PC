<?php

/**
 * Taelcel v1 Client for PHP (version 1.0.0)
 * 
 * Copyright © Desarrolladora de Sistemas Teconológicos de Guerrero S.A. de C.V. All rights reserved.
 * http://www.taecel.mx/
 * soporte@taecel.mx
 */

class Taecel
{
	var $key;
	var $nip;
	var $funcion;
	var $parametros;
	var $url;
	var $respuesta;

	function __construct($key, $nip, $funcion, $parametros = null)
    {
		$this->key  		= $key;
		$this->nip 			= $nip;
		$this->funcion  	= $funcion;
		$this->parametros  	= $parametros;
		$this->url = 'https://taecel.com/app/api/'.$this->funcion;
		if($parametros != null){
			$this->SendRequest($this->url, $this->key, $this->nip, $this->funcion, $this->parametros);	
		}else{
			$this->SendRequest($this->url, $this->key, $this->nip, $this->funcion);
		}
		
    }

	public function SendRequest($url, $key, $nip, $funcion, $parametros = null, $timeout = 5){
		$postfields = 'key='.$key.'&nip='.$nip;
		if($parametros != null){
			foreach ($parametros as $keyp => $parametro) {
				$postfields .= '&'.$keyp.'='.$parametro;
			}	
		}
		$ch = curl_init();
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
		curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
		curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
		curl_setopt($ch, CURLOPT_URL,$url);
		curl_setopt($ch, CURLOPT_POST, TRUE);
		curl_setopt($ch, CURLOPT_POSTFIELDS, $postfields);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $timeout);
		curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
		$response = curl_exec ($ch);
		curl_close ($ch);
		$this->respuesta = $response;
	}
}