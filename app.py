#| Title: Geometry Genocide
#| Version: 1.0
#| Author: Sam Macpherson
#| Description: A single player retro shooter for windows and linux.
__doc__ = 'Creates an instance of the App class, loads the main menu and \
enters main loop.'
	
from interface import Interface
from library import Time


class App(Interface):
	'Application Class '

	def loop(self):
		""" Main Loop """
		
		# Initiate Time
		self.clock = Time()
		
		while self._loop:
	
			# Main Loop Time Delta
			self.clock.grandfather()
			self.clock.reset()
			
			# Events
			for event in self.events():
				self.on_event(event)
			
			# Render
			self.background()

			self.user_interface()
			
			self.battlefield()

			# Double Buffer 
			self.flip()
			
		# Close Application after main loop is terminated
		self.window_close()

if __name__ == '__main__' :
	
	game = App()
	game.load_main_menu()
	game.loop()
	
	
