<?php 
/**
 * Taelcel v1 Client for PHP (version 1.0.0)
 * 
 * Copyright © Desarrolladora de Sistemas Teconológicos de Guerrero S.A. de C.V. All rights reserved.
 * http://www.taecel.mx/
 * soporte@taecel.mx
 */
	include 'Taecel.class.php';

	$key = $_POST['key'];
	$nip = $_POST['nip'];
	$funcion = $_POST['funcion'];

	switch ($funcion) {
	    case "RequestTXN":
    	  	$datos = array(
				'producto' => $_POST['producto'],
				'referencia' => $_POST['referencia'],
			);
			$taecel = new Taecel($key, $nip, $funcion, $datos);
			$respuesta = $taecel->respuesta;
			echo $respuesta;
	        break;
	    case "getBalance":
			$taecel = new Taecel($key, $nip, $funcion);
			$respuesta = $taecel->respuesta;
			echo $respuesta;
	        break;
	    case "getProducts":
			$taecel = new Taecel($key, $nip, $funcion);
			$respuesta = $taecel->respuesta;
			echo $respuesta;
	        break;
	    case "getSales":
	    	$bolsa = $_POST['bolsa'];
	    	if($bolsa == 1 || $bolsa == 2){
	    		$datos = array(
					'fecha' => $_POST['fecha'],
					'bolsa' => $bolsa,
				);
	    	}
	    	else{
	    		$datos = array(
					'fecha' => $_POST['fecha'],
				);
	    	}
			$taecel = new Taecel($key, $nip, $funcion, $datos);
			$respuesta = $taecel->respuesta;
			echo $respuesta;
	        break; 
	    case "urlReporteCompra":
			$taecel = new Taecel($key, $nip, $funcion);
			$respuesta = $taecel->respuesta;
			echo $respuesta;
	        break;
	    case "StatusTXN":
	    	$datos = array(
				'transID' => $_POST['transid'],
			);
			$taecel = new Taecel($key, $nip, $funcion, $datos);
			$respuesta = $taecel->respuesta;
			echo $respuesta;
	        break;
	    case "ProgRequestTXN":
	    	$datos = array(
				'producto' => $_POST['producto'],
				'referencia' => $_POST['referencia'],
				'fecha' => $_POST['fecha']
			);
			$taecel = new Taecel($key, $nip, $funcion, $datos);
			$respuesta = $taecel->respuesta;
			echo $respuesta;
	        break;
	    case "CancelProgRequestTXN":
	    	$datos = array(
				'transID' => $_POST['transid'],
			);
			$taecel = new Taecel($key, $nip, $funcion, $datos);
			$respuesta = $taecel->respuesta;
			$obj = json_decode($respuesta, true);
			var_dump($obj);
	        break;
	    case "RegistroCuenta":
	    	$datos = array(
				'nombre' => $_POST['nombre'],
				'apellidos' => $_POST['apellidos'],
				'correo' => $_POST['correo'],
				'telefono' => $_POST['telefono'],
				'nomComercial' => $_POST['nomcom'],
				'forzarActivacion' => $_POST['forzar'],
			);
			$taecel = new Taecel($key, $nip, $funcion, $datos);
			$respuesta = $taecel->respuesta;
			echo $respuesta;
	        break;
	    case "getBancosCte":
                $taecel    = new Taecel($key, $nip, $funcion);
                $respuesta = $taecel->respuesta;
                echo $respuesta;
                break;
        case "getReports":
                $datos = array(
                    'fecha'         => $_POST['fecha'],
                    'lastid'        => $_POST['lastid'],
                );
                $taecel    = new Taecel($key, $nip, $funcion,$datos);
                $respuesta = $taecel->respuesta;
                echo $respuesta;
                break;
        case "traspasoPago":
                $datos = array(
                    'tipo_bolsa'  => $_POST['tipo_bolsa'],
                    'tipo'        => $_POST['tipo'],
                    'folio'       => $_POST['folio'],
                    'monto'       => $_POST['monto'],
                    'nota'        => $_POST['nota'],
                    'clienteID'   => $_POST['clienteID'],
                );
                $taecel    = new Taecel($key, $nip, $funcion,$datos);
                $respuesta = $taecel->respuesta;
                echo $respuesta;
                break;
        case "CreaUsuario":
                $datos = array(
                    'userName' => $_POST['userName'],
                    'nombres'       => $_POST['nombres'],
                    'apellidos'      => $_POST['apellidos'],
                    'correo'      => $_POST['correo'],
                    'password'       => $_POST['password'],
                    'telefono'  => $_POST['telefono'],
                    'idRol'  => $_POST['idRol'],
                );
                $taecel    = new Taecel($key, $nip, $funcion, $datos);
                $respuesta = $taecel->respuesta;
                echo $respuesta;
                break;
	    default:
	        echo "Método no encontrado";
	}
?>