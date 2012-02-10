#| Author: Sam Macpherson
__doc__ = 'This module contains a series of classes which contribute to the \
overall game play'

from math import sin, cos, pi, acos, asin, radians, ceil
from random import uniform, choice

from library import System,Global,Sprite,Vector, Text, Time, Draw


class Logo(Sprite):
	""" Main logo object """
	def __init__(self):
		self.image = 'logo.png'
		self.position = Vector(0,0)
		self.load_image()
		self.center = self.get_center()
		self.transparency(0)
		self.time = Time()
	
	def reload(self):
		# Fade in
		if self.time < 3:
			self.transparency(80*self.time.period()/1000.0)

class PlayBtn(Sprite):
	""" Play button object """
	def __init__(self):
		self.position = Vector(0,0)
		self.image = 'play.png'
		self.load_image()
		self.center = self.get_center()
		self.transparency(0)
		self.time = Time()
	
	def reload(self):
		# Fade in
		if self.time < 3:
			self.transparency(80*self.time.period()/1000.0)
			
class ExitBtn(Sprite):
	""" Exit button object """
	def __init__(self):
		self.position = Vector(0,0)
		self.image = 'exit.png'
		self.load_image()
		self.center = self.get_center()
		self.transparency(0)
		self.time = Time()
	
	def reload(self):
		# Fade in
		if self.time < 3:
			self.transparency(80*self.time.period()/1000.0)
	
	
class Euclidean(Draw):
	""" Base class for all matrix objects """
	
	def render(self):
		""" Substitutes trace method for render method """
		self.trace()
		
	def pinata(self,radius):
		""" Creates a set of circle instances associated with points in a matrix """
		for i in range(len(self.matrix)):
			Global.enemies += [Circle(self.position+self.matrix[i],radius,self.color,
			self.color2)]

	def follow(self):
		""" Calculates the unit direction vector from object position to player 
			position a displacer is added to slightly disperse a horde of enemies"""
		self.direction = -(self.position-(Global.SpaceShip_position+self.displacer))

	def attack(self):
		""" Similar to the follow method except the object is directed slightly 
		ahead of the spaceship"""
		self.direction = -(self.position-(self.displacer+Global.SpaceShip_position+\
		Global.SpaceShip_direction*100))
	
	def accelerate(self):
		""" Overrides base method in system, to account for deathstars, enemy
			objects are attracted to the closest deathstart"""
			
		if Global.deathstars != []:
			closest_deathstar = sorted(Global.deathstars,key=
			lambda x:  abs(self.position-x.position))[0]
			self.direction = -(self.position-(closest_deathstar.position+self.displacer))
		Draw.accelerate(self)
		
	def load(self):
		""" Prepares enemy object """
		self.position = Vector()*50 +  Vector.origin
		self.position *= [choice([1,-1]),choice([1,-1])]
		self.original = self.copy()
		self.speed = 0.05
		self.direction = Vector()
		self.displacer = Vector()*32
		self.time = Time()
	
	def bounce(self):
		""" flips direction of objects to stop going off screen """
		if abs(self.position.x) >= Global.window[0]/2:
			self.direction.x *= -1
			self.position.x *= 0.99
		elif abs(self.position.y) >= Global.window[1]/2:
			self.direction.y *= -1
			self.position.y *= 0.99

	def reload(self):
		""" base reload method """
		self.bounce()
		self.rotate(Global.milliseconds/10)
		self.accelerate()
	
	def fusion(self,radius):
		""" draws a set of circles associated with points in a matrix """
		for i in range(len(self.matrix)):
			self.nice_circle(self.position+self.matrix[i],radius,self.color,self.color2)
	def remove(self):
			Global.enemies.remove(self)

	def destruct(self):
		""" base destruct method"""
		Global.particles.append(Explosion(self.position.tupl(),15,self.color))
		Global.enemies.remove(self)
		Global.score += self.score


		
class CrossHair(Sprite,System):
	""" Cursor object """
	def __init__(self):

		self.image = 'cursor.png'
		self.load()
		self.position = Vector(0,0)
		
	def reload(self):
		self.position.x, self.position.y = self.get_mouse_position()
	
class Square(Euclidean):
	'Square Enemy'
	
	def __init__(self):
		self.position = Vector(0,0)
		self.play('square.wav')
		self.matrix =  [15,15], [-15,15], [-15,-15],[15,15], [15,-15],[-15,-15]\
		,[-15,15],[15,-15]  
		self.color = 255,32,255
		self.color2 = 255,32,255
		self.load()
		self.speed = 0.15
		self.score = 450
		
		
	def reload(self):
		self.follow()
		self.rotate(self.direction.angle())
		self.accelerate()
		
	def destruct(self):
		Euclidean.destruct(self)
		Global.enemies += [Square2(Vector(10,5) + self.position),
		Square2(Vector(-10,-5) + self.position)]
	
class Square2(Euclidean):
	""" Child square object """
	def __init__(self,vector):
		self.matrix = [10,10], [-10,10], [-10,-10],[10,10], [10,-10],[-10,-10],\
		[-10,10],[10,-10]
		self.color = 255,32,255
		self.color2 = 255,32,255
		self.load()
		self.speed = 0.2
		self.score = 150
		self.position = vector
		
		
	def reload(self):
		self.bounce()
		self.rotate(Global.milliseconds/5)
		self.accelerate()
		
class Octagon(Euclidean):
	""" Octagon Enemy"""
	def __init__(self):
		self.play('octagon.wav')
		self.position = Vector(0,0)
		self.matrix = [1.207,0.5], [0.5,1.207], [-0.5,1.207],[-1.207,0.5]\
		,[-1.207,-0.5],[-0.5,-1.207],[0.5,-1.207],[1.207,-0.5]
		self.scale(25)
		self.color =  255,128,32
		self.color2 = 255,128,64
		self.load()
		self.speed = 0.25
		self.score = 1650
		
	def render(self):
		self.trace()
		self.fusion(7)
		
	def destruct(self):
		Euclidean.destruct(self)
		self.pinata(7)
			
	def reload(self):
		self.attack()
		self.rotate(Global.milliseconds/10)
		self.accelerate()
	
class Triangle2(Euclidean):
	""" Triangle enemy """
	def __init__(self):
		self.position = Vector(0,0)
		self.play('triangle2.wav')
		self.matrix = [-0.5,-3**0.5/4], [0.5,-3**0.5/4], [0,3**0.5/4]
		self.scale(30)
		self.color = 174,203,0
		self.color2 = 0,128,0
		self.load()
		self.speed = 0.2
		self.score = 550
		
	def reload(self):	
		self.bounce()
		self.rotate(Global.milliseconds/18)
		self.accelerate()	
		
	def render(self):
		self.trace()
		self.fusion(8)
		
	def destruct(self):
		Euclidean.destruct(self)
		self.pinata(8)
		
class Rhombus(Euclidean):
	"""Rhombus enemy"""
	
	def __init__(self):
		self.play('rhombus.wav')
		self.position = Vector(0,0)
		self.matrix =  [-15,0], [0, 25], [15,0], [0, -25] 
		self.color = 0,200,255
		self.color2 = 0,140,200
		self.load()
		self.speed = 0.15
		self.score = 100
	
	def reload(self):
		self.follow()
		self.accelerate()
		
class Circle(Euclidean):
	""" Circle enemy"""
	def __init__(self,position=None,radius=10,color=(32,64,255),
	color2=(50,200,255)):

		self.position = Vector(0,0)
		
		if position:
			self.position.x,self.position.y = position
		else:
			self.position.x,self.position.y = Vector.origin + Vector()*50
			self.position *= [choice([1,-1]),choice([1,-1])]
		self.radius = radius
		self.speed = 0.35
		self.direction = ~Vector()
		self.displacer = ~Vector()*25
		self.color = color
		self.color2 = color2
		self.score = 300
	
	def reload(self):
		self.follow()
		self.accelerate()

	def render(self):
		self.reload()
		self.nice_circle(self.position,self.radius,self.color,self.color2)

		
class Explosion(Draw):
	""" Explosion object """
	def __init__(self,pos,size,color,span=1,speed=1):
		self.particles = []
		self.color = color
		self.speed = speed
		self.span = span
		self.position = Vector(pos[0],pos[1])
		
		for i in range(size):
			self.particles.append(Vector() + Vector())
		
		self.time = Time()
	
	def render(self):
		if self.time > self.span:
			self.destruct()
			
		for particle in self.particles:
			self.line(self.position+particle*self.speed*self.time.period(),self.position+particle\
			*self.speed*self.time.period()*1.1,self.color)
		
	def destruct(self):
		Global.particles.remove(self)
	
class DeathStar(Sprite):
	""" Deathstar enemy"""
	def __init__(self):
		self.play('deathstar.wav')
		self.image = 'deathstar.png'
		self.position = -(Global.SpaceShip_position+Vector(0,0))
		self.lives = 20

		if abs(self.position-Global.SpaceShip_position) < 100:
			self.position += 150,150
		self.circles = 5
		self.load()
		
	def hit(self):
		self.lives -= 1
		
	def reload(self):
		if self.lives < 1:
			self.play('deathstar2.wav')
			self.destruct()
			for i in range(self.circles):
				Global.enemies += [Circle(self.position+Vector()*100)]			
		
		for terrorist in Global.enemies:
			if abs(terrorist.position-self.position) < 50:
				terrorist.destruct()
				self.circles += 1
				break
	
	def destruct(self):
		Global.deathstars.remove(self)
	#	Global.particles.append(Explosion(self.position.tupl(),100,(235,97,61)))
	

class Pinwheel(Euclidean):
	""" Pinwheel enemy"""
	def __init__(self):
		self.play('pinwheel.wav')
		self.matrix = [0,0], [0,1],[0.5,0.5],[-0.5,-0.5],[0,-1],[0,0],[1,0],\
		[0.5,-0.5],[-0.5,0.5], [-1,0]
		self.position = Vector(0,0)
		self.scale(20)
		self.load()
		self.color = 200,64,255
		self.color2 = 76,0,184
		self.score = 50
		
	
	def reload(self):
	
		self.bounce()
		self.rotate(-Global.milliseconds/10)
		self.accelerate()
		
class Bullet(Euclidean):
	""" Bullet object """
	def __init__(self,position=(0,0),angle=0):
		self.matrix = [-2,0], [0,1], [2,0], [0,-1] 
		self.scale(5)
		self.color = 255,0,0
		self.color2 = 255,200,200
		self.position = Vector(position[0],position[1])
		self.direction = Vector(cos(radians(angle)),sin(radians(angle)))
		self.speed = 1
		self.original = self.copy()
		self.time = Time()	
		self.rotate(angle)
	
	def destruct(self):
		Global.bullets.remove(self)
		return True

	def accelerate(self):
		Draw.accelerate(self);

	def reload(self):
		
		if abs(self.position.x)-50 < Global.window[0]/2 and \
		 abs(self.position.y)-50 < Global.window[1]/2:
			for planet in Global.deathstars:
				if abs(planet.position-self.position) < 64:
					planet.hit()
					self.destruct()
					return True
					break
					
			for terrorist in Global.enemies:
				if abs(terrorist.position-self.position) < 38:
					self.destruct()
					terrorist.destruct()
					return True
					break
			else:
				self.accelerate()
		else:
			self.destruct()
			
class SpaceShip(Sprite):
	""" SpaceShip object player controlled"""

	def init(self):
		self.image = 'player.png'
		self.load()
		self.position = Vector(0,0)
		self.speed = 0.35
		self.shooting = False
		self.shot_delay = 0.15
		self.direction = Vector(0,0)
		self.time = Time()
		
	def start_shooting(self):
		self.shooting = True
		
	def stop_shooting(self):
		self.shooting = False
		
	def reload(self):
		if self.shooting:
			if self.time > self.shot_delay:
				self.time.reset()
				angle = (self._cursor.position - self.position).angle()
				Global.bullets += [Bullet(self.position.tupl(),angle)]

				if Global.score > 150000:
					Global.bullets += [Bullet(self.position.tupl(),angle-3)]
					
				if Global.score > 25000:
					Global.bullets += [Bullet(self.position.tupl(),angle+3)]
					
				elif Global.score > 50000:
					self.shot_delay = 0.09
				elif Global.score > 10000:
					self.shot_delay = 0.12
					
				
			
		if  (self.position.x <= -Global.window[0]/2 and self.direction.x < 0) or \
		 (self.position.x >= Global.window[0]/2 and self.direction.x > 0):
			self.direction.x = 0
		elif (self.position.y <= -Global.window[1]/2 and self.direction.y < 0) or \
		(self.position.y >= Global.window[1]/2 and self.direction.y > 0):
			self.direction.y = 0
			
		for terrorist in Global.enemies + Global.deathstars:
			if abs(terrorist.position-self.position) < 32:
				self.destruct()
				break
		else:
			self.accelerate()
			Global.SpaceShip_position = self.position.tupl()
			Global.SpaceShip_direction = ~self.direction
			
	
	def destruct(self):
	
		while len(Global.enemies) > 0:
			Global.enemies[-1].remove()
			
		while len(Global.deathstars) > 0:
			Global.deathstars[-1].destruct()
			
		Global.lives -= 1
		if Global.lives < 1:
			Global.particles.append(Explosion(self.position.tupl(),200,(255,255,200),5,0.2))
			self.load_main_menu()	
			self.score = Text() << Global.score
			self.score.log('scores.txt') 
			self.play('die.wav')
			
		else:
			Global.particles.append(Explosion(self.position.tupl(),200,(255,255,200)))
			self.init()
			
			self.play('die1.wav')
		
		
		

class Gameplay(SpaceShip):
	"""Game play class"""
	
	def start_game(self):
		# initiate spaceship
		SpaceShip.init(self)
		# initiate timers
		self.reset_clocks(True)
		self.cluster_size = 8

	def battlefield(self):
		# if in game
		if not self.main_menu:
		
			self.assult()
			
			self.render()

			self._cursor.render()
			
			for obj in Global.bullets:
				obj.render()
			
			for obj in Global.deathstars:
				obj.render()

			for obj in Global.enemies:
				obj.render()

			for obj in Global.particles:
				obj.render()

		else:
			 for obj in Global.particles:
				 obj.render()

	def add(self,geo=None,x=1):
		"""Spawns any enemy object if geo is undefined spawn random enemy"""
		for i in range(x):
			if geo is None:
				geo = choice((Pinwheel,Rhombus,Square,Rhombus))
			self.cluster.append(geo)
			geo = None
			
		
	def add_cluster(self,enemy,num):
		""" Spawn a cluster of enemies """
		for i in range(num):
			self.cluster.append(enemy)
		
	def reset_clocks(self,init=False):
		""" creates a list of Time instances """
		self.timer = [Time() for i in range(8)]
		self.cluster = []

	""" main game play algorithm """
	def assult(self):
		
		# delay the spawning of enemies
		if self.cluster != []:
			if self.timer[0] > 0.01:
				self.timer[0].reset()
				Global.enemies += [self.cluster.pop(0)()]
	
		# Every 60s
		if self.timer[1] > 60:
			self.timer[1].reset()
			Global.deathstars += [DeathStar()]
			
		
			
		#before 2 minute
		if self.timer[-1] < 120:
		
			
			# Every 3s
			if self.timer[2] > 3:
				self.timer[2].reset()
				self.add(None,2)
				# add an enemy if number gets below 20
				if  len(Global.enemies) < 25:
					self.add()
		
		
			# Every 11s
			if self.timer[3] > 11:
				self.timer[3].reset()
				self.add(None,2)
				self.add(Square)
			
			# Every 17s
			if self.timer[4] > 17:
				self.timer[4].reset()
				self.add(None,2)
				self.add_cluster(choice((Pinwheel,Rhombus)),self.cluster_size)
				self.cluster_size += 1
			
			# Every 23s
			if self.timer[5] > 23:
				self.timer[5].reset()
				self.add(Triangle2)
				self.add_cluster(Square,self.cluster_size)
				self.cluster_size += 1

			# Every 39s 
			if self.timer[6] > 39:
				self.timer[6].reset()
				self.add(None,3)
				self.add(Octagon)
			
			
		else: # if after 2 mins since game start
	
	
			# Every 3sec
			if self.timer[2] > 3:
				self.timer[2].reset()
				self.add(Square)
				self.add(Pinwheel)
				self.add(Triangle2)
				self.add()
			
		# Every 11 sec
			if self.timer[3] > 11:
				self.timer[3].reset()
				self.add_cluster(choice((Triangle2,Square,Rhombus)),self.cluster_size)
				self.add(None,2)

		# Every  17 sec
			if self.timer[4] > 17:
				self.timer[4].reset()
				self.add(choice((Octagon,Circle,Triangle2)),self.cluster_size)
				self.add(None,3)
				self.add(Octagon)
			
			# Every 25 sec
			if self.timer[5] > 25:
				self.timer[5].reset()
				Global.deathstars += [DeathStar()]
				self.add(None,4)
			
			# Every 32 sec
			if self.timer[5] > 32:
				self.timer[5].reset()
				Global.deathstars += [DeathStar()]
				self.add(None,5)
			
			# Every 46s
			if self.timer[6] > 46:
				self.timer[6].reset()
				self.add_cluster(choice(Triangle2,Rhombus,Circle,Pinwheel),self.cluster_size)
				self.add(None,10)


