#| Title: Geometry Genocide
#| Version: 1.0
#| Author: Sam Macpherson
#| Description: A single player retro shooter for windows and linux.
__doc__ = 'This module contains the Interface class, the interface class is \
responsible for handling events and switching between the main menu and \
the in game menu.'

from pygame.locals import *

from library import Global, Text, Vector
from game import Gameplay, Logo, PlayBtn, ExitBtn, CrossHair

class Interface(Gameplay):
	""" Interface Class """
	
	def user_interface(self):
		""" Returns a list of interface objects to be rendered"""
		
		if self.main_menu:
			self.play_button.render()
			self.exit_button.render()
			self.logo.render()
		else:
			self.lives << Global.lives
			self.score << Global.score
			self.score.render()
			self.lives.render()
			

	def load_game_interface(self):
		""" Loads the in game interface items and initiates a game"""
		
		# Hide default cursor and replace with cross-hair
		self.mouse_visible(False)
		self._cursor = CrossHair()
		
		# Reset Scores and Lives
		Global.score = 0
		Global.lives = 3
		
		# Turn off main menu and initiate game
		self.main_menu = False
		self.start_game()
		
		# Load and position text objects
		self.score = Text() 
		self.score.position += [100, Vector.origin[1]-30]
		self.lives = Text()
		self.lives.position  += [-100, Vector.origin[1]-30]
		
	
	def load_main_menu(self):
		""" Loads the in main menu interface"""
		
		# Make the cursor visible
		self.mouse_visible(True)
		self.main_menu = True
		
		# Load and position the logo and menu
		self.logo = Logo()
		self.logo.position += 0,100
		self.play_button = PlayBtn()
		self.play_button.position += -250,0
		self.exit_button = ExitBtn()
		self.exit_button.position += 255,0
		
			
	def on_event(self,event):
		"""Catches keyboard and mouse motion and calls respective handlers"""
		
		if event.type == QUIT:
			# Terminate main loop
			self._loop = False
			
		elif event.type == KEYDOWN:
			self.key_down(event.key)
	
		elif event.type == KEYUP:
			self.key_up(event.key)
		
		elif event.type == MOUSEBUTTONDOWN:
			# if in game
			if not self.main_menu:
				self.start_shooting()
		
			
		elif event.type == MOUSEBUTTONUP:
			if self.main_menu:
				# determine if mouse click is near the play button
				if abs(self.play_button.position-self.get_mouse_position()) <150:
					self.load_game_interface()
					
				# determine if mouse click is near the exit button
				elif abs(self.exit_button.position-self.get_mouse_position()) <150:
					self._loop = False
			else:
				self.stop_shooting()
	
	def key_down(self, key):
		""" Handles direction changes prompted by keyboard input W => up, 
			s => down, a => left, d => right"""
			
		if not self.main_menu:	
			if key == K_w: self.direction.y = 1
			
			if key == K_s: self.direction.y = -1
			
			if key == K_a: self.direction.x = -1
			
			if key == K_d: self.direction.x = 1
				
			if self.direction != [1,0]:
				self.rotate(int(self.direction.angle()))
		
	def key_up(self, key):
		""" Handles direction changes prompted by keyboard input W => up, 
			s => down, a => left, d => right"""
		if not self.main_menu:	
			if key == K_w:
				if self.direction.y > 0: self.direction.y = 0
				
			if key == K_s:
				if self.direction.y < 0: self.direction.y = 0
				
			if key == K_a:
				if self.direction.x < 0: self.direction.x = 0
				
			if key == K_d:
				if self.direction.x > 0: self.direction.x = 0
		
			if self.direction != [1,0]:
				self.rotate(int(self.direction.angle()))
			
			# If Escape key is hit return to main menu by forcing game over
			if key == K_ESCAPE:
				Global.lives = 0
				self.destruct()
				
			
